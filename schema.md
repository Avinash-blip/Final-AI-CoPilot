# DATASET_SCHEMA.md

## 📦 Overview
This schema file documents the structure, purpose, and meaning of each dataset uploaded into the File Search Store...

## 1. Dataset: indent_trips_epod_data.csv
### Purpose
Contains trip-level operational data...

### Key Columns
- trip_id: Unique identifier
- indent_display_id: Human readable indent id
- route_name: Route or corridor
- transporter_name: Transporter handling trip
- epod_status: EPOD workflow status
- delay_status: SLA breach indicator

## 2. Dataset: trips_closed_data.xlsx
### Purpose
Closed trips dataset with computed actuals.

### Key Columns
- trip_id
- origin
- destination
- actual_dispatch_time
- actual_delivery_time
- actual_distance_km
- epod_received_time
- sla_met

## 3. Dataset: RAG Sources.xlsx
### Purpose
Contains narrative metadata and contextual info to support RAG.

### Suggested Sections
- Operational Glossary
- Column Definitions
- Business Rules
- Transporter Profiles
- Operational Workflows
