\-- FT OPS COPILOT — SQL TEMPLATE LIBRARY

\-- TEMPLATE: Transporter Delay Ranking  
SELECT  
  trip\_transporter\_name,  
  COUNT(\*) AS total\_trips,  
  SUM(CASE WHEN sta\_breached\_alert \> 0 THEN 1 ELSE 0 END) AS delayed\_trips,  
  (SUM(CASE WHEN sta\_breached\_alert \> 0 THEN 1 ELSE 0 END) \* 100.0 / COUNT(\*)) AS delay\_percentage  
FROM trips\_full  
WHERE trip\_transporter\_name IS NOT NULL AND trip\_transporter\_name \!= ''  
GROUP BY trip\_transporter\_name  
HAVING COUNT(\*) \>= 5  
ORDER BY delay\_percentage DESC;

\-- TEMPLATE: Route Delay %  
SELECT  
  route\_name\_derived AS route,  
  COUNT(\*) AS total\_trips,  
  SUM(CASE WHEN sta\_breached\_alert \> 0 OR "Total Long Stoppage Alerts" \> 0 THEN 1 ELSE 0 END) AS delayed\_trips,  
  (SUM(CASE WHEN sta\_breached\_alert \> 0 OR "Total Long Stoppage Alerts" \> 0 THEN 1 ELSE 0 END) \* 100.0 / COUNT(\*)) AS delay\_percentage  
FROM trips\_full  
GROUP BY route\_name\_derived  
HAVING COUNT(\*) \>= 5  
ORDER BY delay\_percentage DESC;

\-- TEMPLATE: Abnormal Stoppages  
SELECT \*  
FROM trips\_full  
WHERE "Total Long Stoppage Alerts" \> 0;

\-- TEMPLATE: Late EPOD  
SELECT \*  
FROM trips\_full  
WHERE EPOD\_SUBMITTED\_BUCKET \= '24+ hrs';

