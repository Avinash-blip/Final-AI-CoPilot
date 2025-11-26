Sno	Column	Type	Example	Nullable	Description  
1	trip\_id	string	TRP-239842	FALSE	Primary unique identifier for the trip record.  
2	master\_trip\_id	string	MTR-239842	TRUE	Identifier linking child trips or split journeys to one master trip.  
3	trip\_transporter\_name	string	Delhivery	FALSE	Transporter associated with the trip as per trip data.  
4	transporter\_name	string	TCI	TRUE	Transporter name from indent or EPOD context; used when merged data sources differ.  
5	consignor\_company\_id	string	COM-28373	FALSE	Unique identifier for the consignor company.  
6	consignor\_company\_name	string	Tata Motors	FALSE	Name of the consignor company that created the shipment.  
7	Loading Point Address	string	APL Bangalore West Pantharapalya, Bangalore	TRUE	Full textual address where the trip loading was done.  
8	Unloading Point Address	string	AJAY Bangalore, KT 560064	TRUE	Full textual address where unloading was completed.  
9	route\_name	string	BLR → MUM	TRUE	Primary route name as configured in the system.  
10	route\_name\_derived	string	BLR-MUM-Express	TRUE	Route derived from trip telemetry or computed logic.  
11	onboarded\_route	string	BLR-MUM	TRUE	Route configured during onboarding; used as canonical lane.  
12	indent\_ROUTE	string	BLR-MUM-PTL	TRUE	Route selected during indent creation for planned movement.  
13	trip\_created\_at	timestamp	2025-03-03T14:22:00Z	FALSE	Timestamp when the trip was created in the system.  
14	trip\_closed\_at	timestamp	2025-03-04T21:30:00Z	TRUE	Timestamp when the trip was marked closed; used for SLA and duration analytics.  
15	filter\_date	date	2025-03-03	FALSE	Normalized date column used for filtering in dashboards and aggregations.  
16	epod\_created\_at	timestamp	2025-03-04T19:10:00Z	TRUE	Timestamp when EPOD was uploaded/submitted.  
17	RECEIVED\_AT	timestamp	2025-03-04T20:15:00Z	TRUE	Timestamp when EPOD was received by the system.  
18	Tracking Status	string	In-Transit	FALSE	Current tracking status of the trip (In-Transit, OFD, Delivered, Failed, etc.).  
19	Delivered With Issues	boolean	TRUE	TRUE	Flags whether delivery was completed but had recorded issues.  
20	Consent Status	string	Accepted	TRUE	Driver acceptance status for the indent or trip.  
21	STATUS	string	DELIVERED	TRUE	EPOD document status; used for delivery confirmation analytics.  
22	Mode Of Closure	string	Auto-Closed	TRUE	Indicates how the trip was closed (manual, auto, system rule).  
23	Distance Travelled	float	482.5	TRUE	Total distance travelled by the vehicle during the trip.  
24	transit\_distance	float	460.0	TRUE	Distance computed via transit logs; used for performance analytics.  
25	Total Long Stoppage Alerts	integer	3	TRUE	Count of long stoppage alerts triggered on the trip.  
26	Total Route Deviation Alerts	integer	1	TRUE	Count of route deviation alerts detected for the trip.  
27	sta\_breached\_alert	boolean	TRUE	TRUE	Indicates whether SLA/STA was breached during transit.  
28	Distance Left To Destination	float	15.8	TRUE	Remaining distance to the destination at last tracking update.  
29	running\_time	integer	17	TRUE	Total runtime of the trip in hours (engine-on time).  
30	transit\_time	integer	21	TRUE	Total time in transit from loading to unloading in hours.  
31	Vehicle Number	string	KA01AB1234	TRUE	Vehicle number used for the trip.  
32	Driver Name	string	Ramesh Kumar	TRUE	Name of the driver assigned to the trip.  
33	Driver Numbers	string	\+91-9876543210	TRUE	Driver’s primary contact number.  
34	EPOD\_FTEID	string	EPOD-9873	TRUE	Unique identifier for the EPOD record.  
35	INVOICE\_NO	string	INV-23981	TRUE	Transporter invoice number associated with the trip.  
36	EPOD\_SUBMITTED\_BUCKET	string	0–2 hours	TRUE	Indicates delay category in which EPOD was submitted after delivery.  
37	url	string	https://ft.com/pod/epod\_9873	TRUE	URL to download the EPOD document or image.  
38	comments	string	"Box wet at delivery"	TRUE	Additional comments supplied by field staff or driver.  
39	additional\_comment	string	"Customer accepted with note"	TRUE	Supporting notes or secondary comments about the trip.

