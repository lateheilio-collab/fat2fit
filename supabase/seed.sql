-- Seed data for Fat2Fit public.food_reference_cache (Fineli standard foods)

INSERT INTO public.food_reference_cache (id, name_fi, name_en, energy_kcal, protein_g, carbohydrates_g, fat_g, fiber_g)
VALUES
  ('1', 'Kaurahiutale', 'Oat flakes', 370.0, 14.0, 56.0, 6.9, 11.0),
  ('2', 'Banaani kuorittu', 'Banana peeled', 84.0, 1.1, 18.3, 0.4, 1.8),
  ('3', 'Kananmuna keitetty', 'Egg boiled', 143.0, 12.5, 0.3, 10.3, 0.0),
  ('4', 'Ruisleipä ruispalat', 'Rye bread', 224.0, 8.7, 39.0, 1.4, 11.5),
  ('5', 'Broilerin rintafilee uunissa', 'Chicken breast oven baked', 152.0, 31.0, 0.0, 3.2, 0.0),
  ('6', 'Kevytmaito 1.5%', 'Semi-skimmed milk 1.5%', 46.0, 3.3, 4.8, 1.5, 0.0),
  ('7', 'Kirjolohi uunissa', 'Rainbow trout oven baked', 198.0, 24.2, 0.0, 11.3, 0.0),
  ('8', 'Peruna keitetty kuorineen', 'Potato boiled with skin', 76.0, 1.9, 15.5, 0.1, 1.2),
  ('9', 'Jasmiiniriisi keitetty', 'Jasmine rice boiled', 129.0, 2.7, 28.0, 0.3, 0.4),
  ('10', 'Omena punainen kuorineen', 'Red apple with skin', 52.0, 0.3, 11.4, 0.2, 1.6),
  ('11', 'Kinkkuviipale kevyt', 'Ham slice light', 104.0, 18.0, 1.0, 3.0, 0.0),
  ('12', 'Juustoviipale 15%', 'Cheese slice 15% fat', 248.0, 29.0, 0.0, 15.0, 0.0),
  ('13', 'Kurkku', 'Cucumber', 10.0, 0.6, 1.4, 0.1, 0.7),
  ('14', 'Tomaatti', 'Tomato', 20.0, 0.6, 3.5, 0.2, 1.2),
  ('15', 'Kahvi musta juoma', 'Coffee black beverage', 2.0, 0.1, 0.2, 0.0, 0.0),
  ('16', 'Oliiviöljy', 'Olive oil', 884.0, 0.0, 0.0, 100.0, 0.0),
  ('17', 'Maitorahka rasvaton', 'Quark fat free', 62.0, 10.0, 4.0, 0.2, 0.0),
  ('18', 'Tonnikala vedessä', 'Tuna canned in water', 110.0, 25.0, 0.0, 1.0, 0.0),
  ('19', 'Heraproteiinijauhe', 'Whey protein concentrate powder', 380.0, 75.0, 7.0, 6.0, 0.0),
  ('20', 'Kukkakaali', 'Cauliflower', 23.0, 1.9, 2.4, 0.2, 2.2)
ON CONFLICT (id) DO UPDATE 
SET 
  name_fi = EXCLUDED.name_fi,
  name_en = EXCLUDED.name_en,
  energy_kcal = EXCLUDED.energy_kcal,
  protein_g = EXCLUDED.protein_g,
  carbohydrates_g = EXCLUDED.carbohydrates_g,
  fat_g = EXCLUDED.fat_g,
  fiber_g = EXCLUDED.fiber_g;
