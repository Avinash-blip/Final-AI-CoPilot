#!/usr/bin/env python3
"""
Smart Data Sampler & Summary Generator for File Search Optimization
Extracts representative samples + generates statistics markdown
"""

import pandas as pd
import sys
from pathlib import Path
import json

def load_csv_safe(filepath, sample_size=None):
    """Load CSV with fallback encoding"""
    try:
        df = pd.read_csv(filepath, low_memory=False, nrows=sample_size)
        print(f"✅ Loaded {filepath}: {len(df)} rows, {len(df.columns)} columns")
        return df
    except Exception as e:
        print(f"❌ Error loading {filepath}: {e}")
        return None

def smart_sample(df, sample_config):
    """Extract smart samples based on operational rules"""
    samples = []
    
    # Detect SLA breach column
    sla_cols = [c for c in df.columns if 'sla' in c.lower() or 'sta' in c.lower()]
    delay_cols = [c for c in df.columns if 'delay' in c.lower()]
    
    # Sample 1: Normal/On-time trips (1000 max)
    try:
        on_time = df
        for col in sla_cols:
            if 'breach' in col.lower():
                on_time = on_time[on_time[col].isna() | (on_time[col] == False) | (on_time[col] == 'FALSE')]
        normal_sample = on_time.sample(min(1000, len(on_time)))
        samples.append(("normal_trips", normal_sample))
        print(f"  📊 Sampled {len(normal_sample)} normal trips")
    except Exception as e:
        print(f"  ⚠️  Normal sampling skipped: {e}")
    
    # Sample 2: Delayed/SLA breached trips (all if <5000)
    try:
        delayed = df
        for col in sla_cols:
            if 'breach' in col.lower():
                delayed = delayed[(delayed[col] == True) | (delayed[col] == 'TRUE')]
        if len(delayed) > 0:
            delayed_sample = delayed.sample(min(5000, len(delayed)))
            samples.append(("delayed_trips", delayed_sample))
            print(f"  📊 Sampled {len(delayed_sample)} delayed trips")
    except Exception as e:
        print(f"  ⚠️  Delay sampling skipped: {e}")
    
    # Sample 3: Exception cases
    try:
        exception_cols = [c for c in df.columns if 'exception' in c.lower() or 'reject' in c.lower()]
        if exception_cols:
            exceptions = df[df[exception_cols[0]].notna()]
            if len(exceptions) > 0:
                exc_sample = exceptions.sample(min(1000, len(exceptions)))
                samples.append(("exception_cases", exc_sample))
                print(f"  📊 Sampled {len(exc_sample)} exception cases")
    except Exception as e:
        print(f"  ⚠️  Exception sampling skipped: {e}")
    
    return samples

def convert_to_narrative(row, columns_to_use):
    """Convert a single row to natural language (concise version)"""
    parts = []
    
    # Priority fields only
    priority_keywords = ['id', 'trip', 'indent', 'transporter', 'route', 'status', 
                         'delay', 'sla', 'breach', 'epod', 'distance', 'time']
    
    selected_cols = [c for c in columns_to_use if any(kw in c.lower() for kw in priority_keywords)][:8]
    
    for col in selected_cols:
        val = row[col]
        if pd.isna(val) or str(val).strip() == '':
            continue
        
        # Super concise format
        parts.append(f"{col.split('_')[-1]}: {str(val)[:50]}")
    
    narrative = " | ".join(parts[:6])  # Max 6 facts, pipe-separated
    return narrative if narrative else "No data"

def generate_summary_stats(df, dataset_name):
    """Generate markdown summary statistics"""
    stats_md = f"# {dataset_name} - Summary Statistics\n\n"
    stats_md += f"**Total Records:** {len(df):,}\\n\\n"
    
    # Status distribution
    status_cols = [c for c in df.columns if 'status' in c.lower()]
    if status_cols:
        stats_md += f"## {status_cols[0]} Distribution\\n"
        counts = df[status_cols[0]].value_counts().head(10)
        for status, count in counts.items():
            pct = (count / len(df)) * 100
            stats_md += f"- {status}: {count:,} ({pct:.1f}%)\\n"
        stats_md += "\\n"
    
    # SLA/Delay stats
    sla_cols = [c for c in df.columns if 'sla' in c.lower() or 'breach' in c.lower()]
    if sla_cols:
        for col in sla_cols[:2]:
            if df[col].dtype == 'bool' or df[col].nunique() < 10:
                stats_md += f"## {col}\\n"
                counts = df[col].value_counts()
                for val, count in counts.items():
                    pct = (count / len(df)) * 100
                    stats_md += f"- {val}: {count:,} ({pct:.1f}%)\\n"
                stats_md += "\\n"
    
    # Top transporters
    trans_cols = [c for c in df.columns if 'transporter' in c.lower() and 'name' in c.lower()]
    if trans_cols:
        stats_md += f"## Top 10 Transporters\\n"
        counts = df[trans_cols[0]].value_counts().head(10)
        for trans, count in counts.items():
            pct = (count / len(df)) * 100
            stats_md += f"- {trans}: {count:,} trips ({pct:.1f}%)\\n"
        stats_md += "\\n"
    
    # Top routes
    route_cols = [c for c in df.columns if 'route' in c.lower() and ('name' in c.lower() or 'code' in c.lower())]
    if route_cols:
        stats_md += f"## Top 10 Routes\\n"
        counts = df[route_cols[0]].value_counts().head(10)
        for route, count in counts.items():
            pct = (count / len(df)) * 100
            stats_md += f"- {route}: {count:,} trips ({pct:.1f}%)\\n"
        stats_md += "\\n"
    
    return stats_md

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 optimize_data.py <csv_file>")
        sys.exit(1)
    
    csv_path = Path(sys.argv[1])
    output_dir = Path("data/optimized")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\\n🚀 Smart Data Optimizer")
    print(f"Input: {csv_path}")
    print(f"Output: {output_dir}/\\n")
    
    # Load data
    df = load_csv_safe(csv_path)
    if df is None:
        sys.exit(1)
    
    dataset_name = csv_path.stem
    
    # Generate summary stats
    print("\\n📊 Generating summary statistics...")
    summary_md = generate_summary_stats(df, dataset_name)
    summary_file = output_dir / f"{dataset_name}_summary.md"
    summary_file.write_text(summary_md)
    print(f"✅ Created: {summary_file} ({len(summary_md)} bytes)")
    
    # Smart sampling
    print("\\n🎯 Performing smart sampling...")
    samples = smart_sample(df, {})
    
    # Convert samples to narrative
    for sample_name, sample_df in samples:
        print(f"\\n📝 Converting {sample_name} to narratives...")
        narratives = []
        cols = list(sample_df.columns)
        
        for idx, row in sample_df.iterrows():
            narrative = convert_to_narrative(row, cols)
            narratives.append(narrative)
            
            if (len(narratives) % 500) == 0:
                print(f"  Processed {len(narratives)} rows...")
        
        # Write to markdown
        md_file = output_dir / f"{dataset_name}_{sample_name}.md"
        md_content = f"# {dataset_name} - {sample_name.replace('_', ' ').title()}\\n\\n"
        md_content += "\\n\\n".join(narratives)
        md_file.write_text(md_content)
        print(f"✅ Created: {md_file} ({len(md_content):,} bytes, {len(narratives)} records)")
    
    print(f"\\n✨ Optimization complete! Files in: {output_dir}")
    print(f"\\n📤 Next: Upload these files to File Search")

if __name__ == "__main__":
    main()
