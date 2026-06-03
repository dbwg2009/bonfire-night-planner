-- Bonfire Night 2025 historical data (imported from Excel spreadsheet)
-- Run with: npx wrangler d1 execute bonfire-night-db --remote --file=./migrations/0002_seed_2025.sql

-- 2025 event
INSERT OR IGNORE INTO events (id,year,name,date,status,meeting_location,event_location,conflict_event_enabled,conflict_event_name,food_split_ratio,food_buffer_factor)
VALUES ('evt-2025',2025,'Bonfire Night 2025','2025-11-05','archived','21 Agincourt Square','Newton Court Farm',1,'Legally Blonde Rehearsal',0.6,1.1);

-- ── Guests ──────────────────────────────────────────────────────────────────────
-- Format: (id, name, rsvp_status, dietary, pickup_time, emergency_contact, on_whatsapp, notes, conflict_event, event_id)

INSERT OR IGNORE INTO guests VALUES ('g25-01','Holly-Rose Parkin','accepted','["burger","sausage"]','','07861675804',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-02','Sophie Evans','accepted','["sausage"]','08:00','07746335064',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-03','Sophie Watson','accepted','["burger","sausage"]','08:20','07481043162',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-04','Hazel Warren','accepted','[]','08:20','07875161561',1,'Bread Roll only',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-05','Cerys Tadman','accepted','["burger"]','08:20','07742024775',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-06','Megan Jenkins','accepted','["burger"]','08:00','07870916861',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-07','Finley Reece','declined','[]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-08','Toby Jones','declined','[]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-09','Jack Gallagher','declined','[]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-10','Emma Nicholls','declined','[]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-11','Oli Hammence','accepted','[]','08:20','07901353494',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-12','Poppy Beaumont','accepted','["burger"]','08:00','07921004775',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-13','Tomas Baggot','accepted','["sausage"]','08:20','07539788540',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-14','Ronin Templeton','accepted','["burger","sausage"]','08:20','07932769848',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-15','Finley Weller','accepted','["burger","sausage"]','08:20','07476508680',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-16','Zach Shepard','accepted','["burger","sausage"]','08:00','07523975885',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-17','Erin White','declined','[]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-18','Ella Evans','declined','[]','','07746335064',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-19','Grace Tait','declined','[]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-20','Miles Roderick','accepted','["burger","sausage"]','08:00','07792312239',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-21','Eleanor Williams','accepted','["burger","sausage"]','08:00','07971293699',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-22','Caitlin Harris','declined','[]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-23','Alfie Doran','accepted','["burger","sausage"]','','07727410861',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-24','Gaia Cobb McCafferty','accepted','["burger","sausage"]','08:00','07398729208',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-25','Francesca Williams','accepted','[]','08:20','07495771491',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-26','Emma Grey','accepted','["burger","sausage"]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-27','Ffion Grey','accepted','["burger","sausage"]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-28','Darcy Addams','declined','[]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-29','Stanley Kirkaldie','accepted','["burger","sausage"]','08:20','07730583137',1,'',1,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-30','Esme (Ffion)','accepted','["burger","sausage"]','08:00','07877211400',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-31','Rhys Rowe','declined','[]','','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-32','Faith Hogan','declined','[]','','07816900250',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-33','Lottie Scott','accepted','["sausage"]','08:00','07597058132',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-34','Theo (Ffion)','accepted','["burger","sausage"]','08:00','',1,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-35','Emma Mather (Emma)','accepted','["burger","sausage"]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-36','Cleo Stanton (Emma)','declined','[]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO guests VALUES ('g25-37','Hannah (Emma)','declined','[]','','',0,'',0,'evt-2025','2025-01-01','2025-01-01');

-- ── Tasks (from ToDo sheet) ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO tasks VALUES ('t25-01','Reserve Fireworks','completed','dbwg2009@gmail.com','pre_event','2025-10-23','Shell Shocked - Sky Candy Fireworks','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-02','Inform Neighbours','completed','dbwg2009@gmail.com','pre_event','2025-11-01','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-03','Clear Footpath','completed','dbwg2009@gmail.com','pre_event','2025-11-01','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-04','Buy Food','completed','dbwg2009@gmail.com','pre_event','2025-11-04','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-05','Get Burgers','completed','alfiedoran19@gmail.com','pre_event','2025-11-04','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-06','Get Firewood/Pallets','completed','dbwg2009@gmail.com','pre_event','2025-11-02','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-07','Get Fireworks','completed','lugsy02@hotmail.com','pre_event','2025-11-02','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-08','Set Up Bonfire','completed','dbwg2009@gmail.com','pre_event','2025-11-04','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-09','Set Up For Fireworks','completed','dbwg2009@gmail.com','pre_event','2025-11-04','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-10','Set Up Seating/Gazebo','completed','dbwg2009@gmail.com','day_of','2025-11-05','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-11','Set Up Firework','completed','dbwg2009@gmail.com','day_of','2025-11-05','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-12','Light Bonfire','completed','dbwg2009@gmail.com','day_of','2025-11-05','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-13','Make Food','completed','lugsy02@hotmail.com','day_of','2025-11-05','','evt-2025','2025-01-01','2025-01-01');
INSERT OR IGNORE INTO tasks VALUES ('t25-14','Light Fireworks','completed','dbwg2009@gmail.com','day_of','2025-11-05','','evt-2025','2025-01-01','2025-01-01');

-- ── Schedule (from Schedule sheet) ──────────────────────────────────────────────
INSERT OR IGNORE INTO schedule_items VALUES ('s25-01','Meet at Agincourt Square','Transportation','16:30','16:50','21 Agincourt Square','dbwg2009@gmail.com','Sunset at 4:30',0,'evt-2025');
INSERT OR IGNORE INTO schedule_items VALUES ('s25-02','Walk Up to Farm','Transportation','16:50','17:30','Newton Court Farm','dbwg2009@gmail.com','',1,'evt-2025');
INSERT OR IGNORE INTO schedule_items VALUES ('s25-03','Set Up Gazebo, Lighting and Tarp','Setup','17:30','','Newton Court Farm','dbwg2009@gmail.com','',2,'evt-2025');

-- ── Finance (from Costs sheet) ───────────────────────────────────────────────────
INSERT OR IGNORE INTO transactions VALUES ('f25-01','Dan Contribution','contribution',65,10,'2025-10-29','dbwg2009@gmail.com','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-02','Hazel Contribution','contribution',25,NULL,'2025-11-03','','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-03','Thomas Contribution','contribution',50,NULL,'2025-10-23','','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-04','Gaia Contribution','contribution',10,NULL,'','','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-05','Oli Contribution','contribution',15,NULL,'2025-10-24','','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-06','Rhys Contribution','contribution',20,NULL,'','','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-07','Fran Contribution','contribution',10,NULL,'2025-11-06','','','contribution','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-08','Fireworks','venue',NULL,170,'','','','expense','evt-2025','2025-01-01');
INSERT OR IGNORE INTO transactions VALUES ('f25-09','Food','food',NULL,20,'','','','expense','evt-2025','2025-01-01');
