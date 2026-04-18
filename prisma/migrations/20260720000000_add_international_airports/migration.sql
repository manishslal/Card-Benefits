-- Add 27 international airports to lounge finder module
-- Idempotent: ON CONFLICT ("iata_code") DO NOTHING ensures safe re-runs.
-- IDs are deterministic (md5 of IATA code) so repeated migrations produce
-- identical rows.

INSERT INTO "lounge_airports" ("id", "iata_code", "name", "city", "timezone", "created_at")
VALUES
  (concat('cl', substr(md5('AMS'), 1, 23)), 'AMS', 'Amsterdam Schiphol Airport', 'Amsterdam', 'Europe/Amsterdam', NOW()),
  (concat('cl', substr(md5('BKK'), 1, 23)), 'BKK', 'Bangkok Suvarnabhumi Airport', 'Bangkok', 'Asia/Bangkok', NOW()),
  (concat('cl', substr(md5('CDG'), 1, 23)), 'CDG', 'Charles de Gaulle Airport', 'Paris', 'Europe/Paris', NOW()),
  (concat('cl', substr(md5('CPT'), 1, 23)), 'CPT', 'Cape Town International Airport', 'Cape Town', 'Africa/Johannesburg', NOW()),
  (concat('cl', substr(md5('DOH'), 1, 23)), 'DOH', 'Hamad International Airport', 'Doha', 'Asia/Qatar', NOW()),
  (concat('cl', substr(md5('DXB'), 1, 23)), 'DXB', 'Dubai International Airport', 'Dubai', 'Asia/Dubai', NOW()),
  (concat('cl', substr(md5('EZE'), 1, 23)), 'EZE', 'Buenos Aires Ezeiza International Airport', 'Buenos Aires', 'America/Argentina/Buenos_Aires', NOW()),
  (concat('cl', substr(md5('FCO'), 1, 23)), 'FCO', 'Rome Fiumicino Airport', 'Rome', 'Europe/Rome', NOW()),
  (concat('cl', substr(md5('FRA'), 1, 23)), 'FRA', 'Frankfurt Airport', 'Frankfurt', 'Europe/Berlin', NOW()),
  (concat('cl', substr(md5('GRU'), 1, 23)), 'GRU', 'São Paulo Guarulhos International Airport', 'São Paulo', 'America/Sao_Paulo', NOW()),
  (concat('cl', substr(md5('HKG'), 1, 23)), 'HKG', 'Hong Kong International Airport', 'Hong Kong', 'Asia/Hong_Kong', NOW()),
  (concat('cl', substr(md5('HND'), 1, 23)), 'HND', 'Tokyo Haneda Airport', 'Tokyo', 'Asia/Tokyo', NOW()),
  (concat('cl', substr(md5('ICN'), 1, 23)), 'ICN', 'Seoul Incheon International Airport', 'Seoul', 'Asia/Seoul', NOW()),
  (concat('cl', substr(md5('JNB'), 1, 23)), 'JNB', 'O.R. Tambo International Airport', 'Johannesburg', 'Africa/Johannesburg', NOW()),
  (concat('cl', substr(md5('LHR'), 1, 23)), 'LHR', 'London Heathrow Airport', 'London', 'Europe/London', NOW()),
  (concat('cl', substr(md5('MAD'), 1, 23)), 'MAD', 'Madrid Barajas Airport', 'Madrid', 'Europe/Madrid', NOW()),
  (concat('cl', substr(md5('MEL'), 1, 23)), 'MEL', 'Melbourne Airport', 'Melbourne', 'Australia/Melbourne', NOW()),
  (concat('cl', substr(md5('MEX'), 1, 23)), 'MEX', 'Mexico City International Airport', 'Mexico City', 'America/Mexico_City', NOW()),
  (concat('cl', substr(md5('NBO'), 1, 23)), 'NBO', 'Nairobi Jomo Kenyatta International Airport', 'Nairobi', 'Africa/Nairobi', NOW()),
  (concat('cl', substr(md5('NRT'), 1, 23)), 'NRT', 'Tokyo Narita International Airport', 'Tokyo', 'Asia/Tokyo', NOW()),
  (concat('cl', substr(md5('PEK'), 1, 23)), 'PEK', 'Beijing Capital International Airport', 'Beijing', 'Asia/Shanghai', NOW()),
  (concat('cl', substr(md5('PVG'), 1, 23)), 'PVG', 'Shanghai Pudong International Airport', 'Shanghai', 'Asia/Shanghai', NOW()),
  (concat('cl', substr(md5('SIN'), 1, 23)), 'SIN', 'Singapore Changi Airport', 'Singapore', 'Asia/Singapore', NOW()),
  (concat('cl', substr(md5('SYD'), 1, 23)), 'SYD', 'Sydney Kingsford Smith Airport', 'Sydney', 'Australia/Sydney', NOW()),
  (concat('cl', substr(md5('YVR'), 1, 23)), 'YVR', 'Vancouver International Airport', 'Vancouver', 'America/Vancouver', NOW()),
  (concat('cl', substr(md5('YYZ'), 1, 23)), 'YYZ', 'Toronto Pearson International Airport', 'Toronto', 'America/Toronto', NOW()),
  (concat('cl', substr(md5('ZRH'), 1, 23)), 'ZRH', 'Zurich Airport', 'Zurich', 'Europe/Zurich', NOW())
ON CONFLICT ("iata_code") DO NOTHING;
