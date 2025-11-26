\# FT OPS COPILOT — SYNONYMS KB

This file maps natural language business terms → actual dataset fields.

\---

\#\# DELAY / SLA TERMS

\- "on time" → sta\_breached\_alert \= 0 AND Total Long Stoppage Alerts \= 0    
\- "delayed", "late" → sta\_breached\_alert \= 1 OR stoppage/deviation alerts \> 0    
\- "SLA breach" → sta\_breached\_alert \= 1    
\- "delay reasons" → stoppages, deviations, late reporting  

\---

\#\# REPORTING TERMS

\- "late reporting" → indent\_reported\_at \- indent\_assigned\_at \> 30 min    
\- "vehicle reported late" → same as above    
\- "reported early" → difference \< expected window  

\---

\#\# STOPPAGE TERMS

\- "stoppage", "halt", "break" → Total Long Stoppage Alerts    
\- "abnormal stoppage" → multiple stoppages or long stoppage duration    
\- "high stoppage density" → alerts per km ratio  

\---

\#\# ROUTE TERMS

\- "lane" → indent\_ROUTE or route\_name\_derived    
\- "route" → same as above    
\- "destination" → Unloading Point Address    
\- "origin" → Loading Point Address  

\---

\#\# TRANSPORTER TERMS

\- "vendor" → trip\_transporter\_name    
\- "carrier", "logistics partner" → trip\_transporter\_name    
\- "fleet operator" → trip\_transporter\_name  

\---

\#\# EPOD TERMS

\- "proof of delivery", "pod" → epod\_created\_at, EPOD\_SUBMITTED\_BUCKET    
\- "late pod" → EPOD\_SUBMITTED\_BUCKET \= '24+ hrs'    
\- "delivered with issues" → Delivered With Issues  

\---

\#\# EXCEPTIONS TERMS

\- "exception" → deviation \+ stoppage \+ sta breach    
\- "multi-exception" → \>=2 exception signals    
\- "bad trips" → exception trips  

\---

\#\# PERFORMANCE TERMS

\- "top transporter" → highest on-time %    
\- "worst transporter" → highest delay %    
\- "route performance" → delay %, transit\_time, exceptions  

\---

\# END OF SYNONYMS KB

