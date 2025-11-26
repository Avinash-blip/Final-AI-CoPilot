\# FT OPS COPILOT — BUSINESS RULES KB  
This file defines all operational logic, formulas, interpretations, and domain rules  
used by the FT Ops Copilot during NL→SQL and SQL→NL phases.  
\---  
\#\# 1\. SLA & ON-TIME DEFINITIONS  
\#\#\# \*\*On-Time Delivery\*\*  
A trip is considered \*\*on time\*\* when ALL conditions are met:  
\- \`sta\_breached\_alert \= 0\`  
\- \`"Total Long Stoppage Alerts" \= 0\`  
\#\#\# \*\*SLA Breach\*\*  
A trip is marked as \*\*delayed\*\* or \*\*breached\*\* if:  
\- \`sta\_breached\_alert \= 1\`  
\- Any stoppage alert or deviation alert is present  
\- Trip reaches destination significantly later than expected running\_time  
\#\#\# \*\*Expected Transit Calculation\*\*  
Operational expected transit is derived from:  
\- \`running\_time\`  
\- \`transit\_time\`  
\- route norms (implicitly derived from historical averages)  
\---  
\#\# 2\. DELAY CATEGORY DEFINITIONS  
\#\#\# \*\*A. Late Reporting\*\*  
Vehicle reported late if:  
\`\`\`  
diff\_minutes \= (indent\_reported\_at \- indent\_assigned\_at) / 60  
late\_reporting \= diff\_minutes \> 30  
\`\`\`  
\#\#\# \*\*B. Long Stoppage Delay\*\*  
Long stoppage contributing to delays:  
\`\`\`  
Total Long Stoppage Alerts \> 0  
\`\`\`  
\#\#\# \*\*C. Route Deviation Delay\*\*  
\`\`\`  
Total Route Deviation Alerts \> 0  
\`\`\`  
\#\#\# \*\*D. Unusual Transit Time\*\*  
\`\`\`  
transit\_time \> (expected\_transit\_time \* 1.25)  
\`\`\`  
\---  
\#\# 3\. EXCEPTION & ANOMALY RULES  
\#\#\# \*\*Exception Trip\*\*  
A trip is considered to have exceptions if ANY of the following:  
\- Long stoppages present  
\- Route deviation alert present  
\- STA breach alert present  
\- Delivered With Issues is not null or \>0  
\#\#\# \*\*Multi-Exception Trip\*\*  
Trip has 2 or more exception types:  
\`\`\`  
(Deviation \> 0\) \+ (Stoppage \> 0\) \+ (STA \> 0\) \>= 2  
\`\`\`  
\#\#\# \*\*Abnormal Stoppage Pattern\*\*  
One or more:  
\- More than 2 stoppages  
\- Stoppages \> 60 minutes  
\- Stoppages clustered or repeated frequently  
\---  
\#\# 4\. EPOD RULES  
\#\#\# \*\*Late POD\*\*  
\`\`\`  
EPOD\_SUBMITTED\_BUCKET \= "24+ hrs"  
OR  
(epod\_created\_at \- trip\_closed\_at) \> 24 hours  
\`\`\`  
\#\#\# \*\*Very Late POD\*\*  
\`\`\`  
\> 48 hours  
\`\`\`  
\#\#\# \*\*Failed or Problematic POD\*\*  
POD is considered problematic if:  
\- STATUS \!= "VERIFIED\_AS\_SUCCESSFULLY\_DELIVERED"  
\- Delivered With Issues is not null  
\- additional\_comment present  
\---  
\#\# 5\. ROUTE RULES  
\#\#\# \*\*Canonical Route Names\*\*  
Use:  
\- \`indent\_ROUTE\`  
\- \`route\_name\_derived\`  
\#\#\# \*\*Human Route Names\*\*  
Use:  
\- \`route\_name\`  
\#\#\# \*\*Risky Route\*\*  
Route is considered risky if:  
\- Delay \> 20%  
\- Route Deviation Alerts high  
\- EPOD delays frequent  
\- Stoppage alerts visible  
\---  
\#\# 6\. TRANSPORTER PERFORMANCE RULES  
\#\#\# \*\*Minimum Trips for Valid Comparison\*\*  
\`\`\`  
HAVING COUNT(\*) \>= 5  
\`\`\`  
\#\#\# \*\*High-Performing Transporter\*\*  
\- High on-time %  
\- Low exceptions  
\- Low route deviations  
\- Consistent reporting  
\#\#\# \*\*Underperforming Transporter\*\*  
\- High SLA breach %  
\- High delays  
\- High EPOD delay  
\- High route deviations or stoppages  
\---  
\#\# 7\. STATUS & LIFECYCLE RULES  
\#\#\# \*\*Trip Lifecycle\*\*  
Key timestamps:  
\- \`trip\_created\_at\`  
\- \`trip\_assigned\_at\`  
\- \`indent\_reported\_at\`  
\- \`trip\_closed\_at\`  
\- \`epod\_created\_at\`  
Missing any of these → trip flagged for inspection.  
\#\#\# \*\*Trips Open Too Long\*\*  
\`\`\`  
(trip\_closed\_at \- trip\_created\_at) \> (transit\_time \* 2\)  
\`\`\`  
\#\#\# \*\*Stuck Trips\*\*  
Trips still in “Tracked” or similar states beyond normal duration.  
\---  
\#\# 8\. CUSTOMER / CONSIGNOR RULES  
\#\#\# \*\*Customer SLA Impact\*\*  
High impact if:  
\- Delay % \> 15%  
\- Exceptions \> baseline  
\- Many EPOD delays  
\- Frequent late reporting at customer site  
\---  
\#\# 9\. RISK SCORING (Heuristic for narrative layer)  
Trip Risk Score:  
\`\`\`  
risk \= (long\_stoppages \* 2\) \+ (route\_deviation) \+ (sta\_breached\_alert \* 3\)  
\`\`\`  
Transporter Risk Score:  
\`\`\`  
risk \= (delay% \* 2\) \+ (exception\_count / total\_trips) \+ epod\_delay\_ratio  
\`\`\`  
Route Risk Score:  
\`\`\`  
risk \= (delay% \* 2\) \+ (avg\_stoppages) \+ (route\_deviations) \+ epod\_delay\_ratio  
\`\`\`  
\---  
\# END OF BUSINESS RULES KB  
