\# FT OPS COPILOT — METRIC DEFINITIONS KB

This file defines all key metrics, formulas, and interpretations used by the agent.

\---

\#\# SLA METRICS

\#\#\# \*\*On-Time %\*\*  
\`\`\`  
on\_time\_trips / total\_trips \* 100  
\`\`\`  
Where on-time \= no STA breach \+ no long stoppages.

\#\#\# \*\*Delay %\*\*  
\`\`\`  
delayed\_trips / total\_trips \* 100  
\`\`\`

\#\#\# \*\*STA Breach Count\*\*  
Number of trips where:  
\`\`\`  
sta\_breached\_alert \> 0  
\`\`\`

\---

\#\# OPERATIONAL METRICS

\#\#\# \*\*Vehicle Reporting Time\*\*  
Time from assignment to vehicle reporting:  
\`\`\`  
(indent\_reported\_at \- indent\_assigned\_at)  
\`\`\`

\#\#\# \*\*Reporting Delay\*\*  
Late if:  
\`\`\`  
\> 30 minutes  
\`\`\`

\#\#\# \*\*Transit Time\*\*  
\`\`\`  
transit\_time (hours)  
\`\`\`

\#\#\# \*\*Running Time\*\*  
Total active movement hours:  
\`\`\`  
running\_time  
\`\`\`

\#\#\# \*\*Distance Travelled\*\*  
Total km covered:  
\`\`\`  
Distance Travelled  
\`\`\`

\---

\#\# STOPPAGE METRICS

\#\#\# \*\*Long Stoppage Alerts\*\*  
Count of long-duration stops.

\#\#\# \*\*Stoppage Density\*\*  
\`\`\`  
Total Long Stoppage Alerts / transit\_distance  
\`\`\`

\#\#\# \*\*Night Stoppage Indicator\*\*  
If stoppage occurred between 11pm–5am (not in dataset; inferred at narrative layer).

\---

\#\# ROUTE METRICS

\#\#\# \*\*Route Delay %\*\*  
\`\`\`  
delayed\_trips\_on\_route / total\_trips\_on\_route \* 100  
\`\`\`

\#\#\# \*\*Average Transit Time by Route\*\*  
\`\`\`  
AVG(transit\_time)  
\`\`\`

\#\#\# \*\*Route Risk Score\*\*  
Weighted composite (narrative only):  
\- Delay %  
\- Stoppage count  
\- Deviation alerts  
\- EPOD delays

\---

\#\# TRANSPORTER METRICS

\#\#\# \*\*Transporter Performance Score\*\*  
Weights (heuristic):  
\- On-time %  
\- Fewer exceptions  
\- Faster reporting  
\- Low deviation alerts

\#\#\# \*\*Exception Ratio\*\*  
\`\`\`  
(exception\_trips / total\_trips)  
\`\`\`

\#\#\# \*\*EPOD Delay Ratio\*\*  
\`\`\`  
(late\_EPODs / total\_EPODs)  
\`\`\`

\---

\#\# EPOD METRICS

\#\#\# \*\*EPOD Submission TAT\*\*  
\`\`\`  
(epod\_created\_at \- trip\_closed\_at)  
\`\`\`

\#\#\# \*\*Late PODs\*\*  
\> 24 hours

\#\#\# \*\*Very Late PODs\*\*  
\> 48 hours

\---

\# END OF METRIC DEFINITIONS KB

