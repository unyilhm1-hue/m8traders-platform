-- Phase 5B: Pattern & Indicator Challenges
-- Additional challenge content

-- ============================================================================
-- PATTERN RECOGNITION CHALLENGES
-- ============================================================================

-- Pattern Challenge 2: Bullish Engulfing
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'pattern_002',
  'pattern',
  2,
  'Pola Bullish Engulfing',
  'Identifikasi pola Bullish Engulfing: candle hijau besar yang "menelan" candle merah sebelumnya. Pola ini menandakan potensi pembalikan ke arah bullish.',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Candle kedua membuka lebih rendah dan menutup lebih tinggi dari candle pertama",
        "correct": true,
        "feedback": "Benar! Bullish Engulfing terjadi ketika candle hijau besar membuka di bawah penutupan candle merah sebelumnya, dan menutup di atas pembukaan candle merah tersebut. Ini menelan sepenuhnya body candle sebelumnya."
      },
      {
        "id": "B",
        "text": "Dua candle hijau berturut-turut dengan ukuran yang sama",
        "correct": false,
        "feedback": "Itu bukan Bullish Engulfing. Engulfing memerlukan satu candle merah diikuti satu candle hijau yang lebih besar."
      },
      {
        "id": "C",
        "text": "Candle hijau kecil di dalam body candle merah besar",
        "correct": false,
        "feedback": "Itu adalah pola Harami, bukan Engulfing. Engulfing adalah kebalikannya - candle kedua yang menelan candle pertama."
      },
      {
        "id": "D",
        "text": "Gap up diikuti candle hijau besar",
        "correct": false,
        "feedback": "Gap up bisa bullish, tapi itu bukan definisi Bullish Engulfing. Engulfing tidak memerlukan gap."
      }
    ],
    "correct_answer": "A",
    "explanation": "Bullish Engulfing adalah pola reversal dua candle. Candle pertama bearish (merah), candle kedua bullish (hijau) yang membuka lebih rendah tapi menutup jauh lebih tinggi, menelan seluruh body candle pertama. Sinyal: potensi pembalikan dari downtrend ke uptrend.",
    "hints": [
      "Perhatikan ukuran relatif kedua candle",
      "Candle kedua harus lebih besar dari candle pertama",
      "Muncul setelah downtrend untuk sinyal reversal terbaik"
    ]
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Pattern Challenge 3: Shooting Star
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'pattern_003',
  'pattern',
  2,
  'Pola Shooting Star',
  'Shooting Star adalah pola satu candle yang menandakan potensi reversal bearish. Identifikasi karakteristik utama dari pola ini.',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Body kecil di bagian bawah, upper wick panjang minimal 2x body, lower wick kecil/tidak ada",
        "correct": true,
        "feedback": "Sempurna! Shooting Star memiliki body kecil di bawah, upper wick panjang (menunjukkan rejection of higher prices), dan sedikit atau tanpa lower wick. Muncul setelah uptrend sebagai sinyal reversal bearish."
      },
      {
        "id": "B",
        "text": "Body kecil di tengah dengan wick panjang di kedua sisi",
        "correct": false,
        "feedback": "Itu lebih mirip Long-Legged Doji, bukan Shooting Star. Shooting Star memiliki wick panjang hanya di atas."
      },
      {
        "id": "C",
        "text": "Body besar dengan wick pendek",
        "correct": false,
        "feedback": "Itu adalah candle normal yang kuat, bukan Shooting Star. Shooting Star harus memiliki body kecil dan upper wick yang sangat panjang."
      },
      {
        "id": "D",
        "text": "Body kecil di atas, lower wick panjang",
        "correct": false,
        "feedback": "Itu adalah Hammer atau Dragonfly Doji (bullish), kebalikan dari Shooting Star. Shooting Star memiliki upper wick panjang, bukan lower wick."
      }
    ],
    "correct_answer": "A",
    "explanation": "Shooting Star terbentuk ketika harga naik tinggi (upper wick panjang) tapi ditolak dan menutup dekat dengan harga pembukaan (body kecil di bawah). Ini menunjukkan bahwa buyers mencoba push harga naik tapi sellers mengambil kontrol. Ketika muncul setelah uptrend, ini adalah sinyal reversal bearish yang kuat.",
    "hints": [
      "Bayangkan \"bintang jatuh\" - ekor panjang di atas",
      "Upper wick menunjukkan rejection",
      "Paling kuat ketika muncul di resistance atau setelah uptrend"
    ]
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Pattern Challenge 4: Doji Variations
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'pattern_004',
  'pattern',
  2,
  'Variasi Pola Doji',
  'Doji memiliki beberapa variasi dengan makna yang berbeda. Manakah dari berikut ini yang merupakan Dragonfly Doji?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Body kecil di atas, lower wick panjang, tanpa upper wick",
        "correct": true,
        "feedback": "Benar! Dragonfly Doji berbentuk seperti capung (dragonfly) dengan ekor panjang di bawah. Ini menunjukkan rejection of lower prices dan potensial reversal bullish."
      },
      {
        "id": "B",
        "text": "Body kecil di bawah, upper wick panjang, tanpa lower wick",
        "correct": false,
        "feedback": "Itu adalah Gravestone Doji (bearish), kebalikan dari Dragonfly. Gravestone memiliki upper wick panjang seperti batu nisan."
      },
      {
        "id": "C",
        "text": "Body kecil di tengah, tanpa wick sama sekali",
        "correct": false,
        "feedback": "Itu adalah Standard Doji. Dragonfly Doji memiliki lower wick yang panjang."
      },
      {
        "id": "D",
        "text": "Body kecil dengan wick panjang di kedua sisi",
        "correct": false,
        "feedback": "Itu adalah Long-Legged Doji atau High Wave Candle. Dragonfly hanya memiliki lower wick panjang."
      }
    ],
    "correct_answer": "A",
    "explanation": "Variasi Doji - Dragonfly: bullish reversal (lower wick panjang), Gravestone: bearish reversal (upper wick panjang), Standard: indecision (no/small wicks), Long-Legged: high volatility (wick panjang kedua sisi). Context sangat penting - lihat trend sebelumnya!",
    "hints": [
      "Dragonfly = capung, bayangkan ekor di bawah",
      "Gravestone = batu nisan, seperti salib dengan wick di atas",
      "Semua Doji menunjukkan indecision, tapi konteks menentukan makna"
    ]
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Pattern Challenge 5: Morning Star
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'pattern_005',
  'pattern',
  3,
  'Pola Morning Star',
  'Morning Star adalah pola tiga candle yang menandakan reversal bullish. Urutan candle yang benar adalah...',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Candle merah besar → Candle kecil (gap down) → Candle hijau besar (gap up)",
        "correct": true,
        "feedback": "Sempurna! Morning Star: (1) Downtrend berlanjut dengan candle merah besar, (2) Gap down ke candle kecil (bisa merah/hijau) menunjukkan indecision, (3) Gap up ke candle hijau besar yang menutup di atas midpoint candle pertama. Sinyal reversal bullish yang sangat kuat!"
      },
      {
        "id": "B",
        "text": "Tiga candle hijau berturut-turut dengan ukuran meningkat",
        "correct": false,
        "feedback": "Itu adalah Three White Soldiers (continuation bullish), bukan Morning Star. Morning Star dimulai dengan candle merah."
      },
      {
        "id": "C",
        "text": "Candle hijau → Doji → Candle merah",
        "correct": false,
        "feedback": "Itu kebalikan dari Morning Star. Anda mendeskripsikan Evening Star (bearish reversal)."
      },
      {
        "id": "D",
        "text": "Candle merah → Candle hijau → Candle merah tanpa gap",
        "correct": false,
        "feedback": "Morning Star memerlukan gap dan candle ketiga harus hijau besar. Tanpa gap, pola ini tidak memiliki kekuatan yang sama."
      }
    ],
    "correct_answer": "A",
    "explanation": "Morning Star adalah salah satu pola reversal bullish paling kuat. Nama \"Morning Star\" karena muncul di bottom seperti bintang pagi yang mengawali hari baru. Candle ketiga harus menutup setidaknya di atas midpoint candle pertama untuk konfirmasi. Semakin besar gap dan candle ketiga, semakin kuat sinyalnya.",
    "hints": [
      "Berlawanan dengan Evening Star (bearish)",
      "Gap adalah kunci untuk kekuatan pola ini",
      "Candle tengah menunjukkan sellers kehilangan momentum"
    ]
  }'::jsonb,
  200
) on conflict (id) do nothing;

-- Pattern Challenge 6: Three White Soldiers
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'pattern_006',
  'pattern',
  3,
  'Pola Three White Soldiers',
  'Three White Soldiers menandakan momentum bullish yang kuat. Apa karakteristik utama pola ini?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Tiga candle hijau berturut-turut, masing-masing membuka di dalam body candle sebelumnya dan menutup lebih tinggi",
        "correct": true,
        "feedback": "Excellent! Three White Soldiers: tiga candle hijau berturut-turut yang masing-masing membuka di dalam body previous candle dan menutup progressively higher. Menunjukkan buying pressure yang konsisten dan kuat. Pola continuation atau reversal bullish yang sangat andal!"
      },
      {
        "id": "B",
        "text": "Tiga candle hijau dengan gap up di antara setiap candle",
        "correct": false,
        "feedback": "Gap bisa terjadi tapi bukan requirement untuk Three White Soldiers. Yang penting adalah: tiga candle hijau berturut-turut dengan open di dalam previous body."
      },
      {
        "id": "C",
        "text": "Tiga candle hijau dengan ukuran yang persis sama",
        "correct": false,
        "feedback": "Ukuran tidak harus persis sama. Yang penting adalah progres konsisten: setiap candle open dalam previous body dan close lebih tinggi."
      },
      {
        "id": "D",
        "text": "Satu candle besar diikuti dua candle kecil",
        "correct": false,
        "feedback": "Itu bukan Three White Soldiers. Ketiga candle harus relatif sama dalam ukuran dan kekuatan, menunjukkan buying pressure yang konsisten."
      }
    ],
    "correct_answer": "A",
    "explanation": "Three White Soldiers adalah pola continuation bullish yang sangat kuat. Nama \"soldiers\" karena tiga candle hijau berbaris maju dengan teratur seperti tentara. Setiap candle membuka di area previous candle (tidak gap away) dan menutup lebih tinggi, menunjukkan buyers secara konsisten mengontrol market. Hindari jika candle ketiga memiliki upper wick sangat panjang (potensi reversal).",
    "hints": [
      "Bayangkan tiga tentara berbaris naik tahap demi tahap",
      "Konsistensi adalah kunci - bukan hanya size tapi juga progres",
      "Berlawanan dengan Three Black Crows (bearish)"
    ]
  }'::jsonb,
  200
) on conflict (id) do nothing;

-- ============================================================================
-- INDICATOR MASTERY CHALLENGES
-- ============================================================================

-- Indicator Challenge 2: MACD Crossover
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'indicator_002',
  'indicator',
  2,
  'MACD Crossover',
  'MACD (Moving Average Convergence Divergence) adalah indikator momentum. Apa yang ditandakan ketika MACD line cross di atas signal line?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Sinyal bullish - momentum bergeser ke arah pembeli",
        "correct": true,
        "feedback": "Tepat! Ketika MACD line (fast) cross di atas signal line (slow), ini menandakan momentum bullish meningkat. Ini adalah buy signal klasik, terutama jika terjadi di bawah zero line (reversal dari downtrend)."
      },
      {
        "id": "B",
        "text": "Sinyal bearish - momentum melemah",
        "correct": false,
        "feedback": "Kebalikan. MACD cross di atas signal line adalah bullish. MACD cross di bawah signal line yang bearish."
      },
      {
        "id": "C",
        "text": "Zona netral - tidak ada sinyal trading",
        "correct": false,
        "feedback": "MACD crossover adalah salah satu sinyal paling populer. Cross di atas signal line adalah sinyal beli yang jelas."
      },
      {
        "id": "D",
        "text": "Sinyal untuk close semua posisi",
        "correct": false,
        "feedback": "MACD cross di atas signal line justru sinyal untuk open buy position, bukan close."
      }
    ],
    "correct_answer": "A",
    "explanation": "MACD terdiri dari dua komponen utama: MACD line (12-EMA minus 26-EMA) dan Signal line (9-EMA dari MACD line). Crossover: MACD > Signal = Bullish, MACD < Signal = Bearish. Histogram (bar) menunjukkan jarak antara keduanya. Pro tip: Crossover di bawah zero line lebih kuat untuk reversal, di atas zero line untuk continuation.",
    "hints": [
      "MACD line lebih cepat, signal line lebih lambat",
      "Cross ke atas = momentum meningkat",
      "Perhatikan posisi terhadap zero line untuk konteks"
    ]
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Indicator Challenge 3: Golden Cross
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'indicator_003',
  'indicator',
  2,
  'Golden Cross vs Death Cross',
  'Golden Cross terjadi ketika MA 50-hari cross di atas MA 200-hari. Apa implikasi dari sinyal ini?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Sinyal bullish jangka panjang yang sangat kuat",
        "correct": true,
        "feedback": "Absolutely! Golden Cross adalah salah satu sinyal bullish paling terkenal. Ketika short-term MA (50) cross di atas long-term MA (200), ini menandakan shift momentum dari bearish ke bullish. Sering menandai awal bull market baru!"
      },
      {
        "id": "B",
        "text": "Sinyal bearish - waktu untuk jual",
        "correct": false,
        "feedback": "Kebalikan! Itu adalah Death Cross (MA 50 cross di bawah MA 200). Golden Cross adalah sinyal bullish."
      },
      {
        "id": "C",
        "text": "Sinyal netral - MA crossing tidak penting",
        "correct": false,
        "feedback": "Golden Cross dan Death Cross adalah dua sinyal MA paling penting dan diikuti oleh institutional traders worldwide."
      },
      {
        "id": "D",
        "text": "Sinyal untuk day trading saja",
        "correct": false,
        "feedback": "Golden Cross menggunakan MA 50 dan 200 hari, ini adalah sinyal jangka panjang untuk swing/position trading, bukan day trading."
      }
    ],
    "correct_answer": "A",
    "explanation": "Golden Cross (bullish) vs Death Cross (bearish) adalah dua sinyal MA paling iconic. Golden Cross: MA 50 > MA 200 = bullish long-term. Death Cross: MA 50 < MA 200 = bearish long-term. Catatan: Karena menggunakan MA jangka panjang, sinyal ini lagging (terlambat) tapi sangat andal untuk trend identification. Banyak institutional traders menggunakannya untuk allocate capital.",
    "hints": [
      "Golden = emas = bagus = bullish",
      "Death = kematian = buruk = bearish",
      "Sinyal jangka panjang, bukan untuk scalping"
    ]
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Indicator Challenge 4: Volume Confirmation
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'indicator_004',
  'indicator',
  2,
  'Konfirmasi Volume',
  'Sebuah saham breakout dari resistance dengan volume rendah (di bawah average). Apa yang sebaiknya Anda lakukan?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Hati-hati - breakout dengan volume rendah sering false breakout",
        "correct": true,
        "feedback": "Sangat bijak! Volume adalah konfirmasi penting untuk breakout. Volume rendah = kurang conviction = higher risk of false breakout/fake out. Tunggu volume meningkat atau konfirmasi lain sebelum entry."
      },
      {
        "id": "B",
        "text": "Beli segera - volume tidak penting untuk breakout",
        "correct": false,
        "feedback": "Volume sangat penting! Breakout tanpa volume adalah red flag. Professional traders selalu cari volume confirmation sebelum entry pada breakout."
      },
      {
        "id": "C",
        "text": "Short saham karena volume rendah bearish",
        "correct": false,
        "feedback": "Volume rendah bukan sinyal untuk short. Itu hanya menandakan kurang conviction. Tunggu konfirmasi arah sebelum trading."
      },
      {
        "id": "D",
        "text": "Volume hanya penting untuk saham kecil, bukan blue chip",
        "correct": false,
        "feedback": "Volume penting untuk semua saham. Bahkan blue chip butuh volume untuk mengkonfirmasi breakout yang legitimate."
      }
    ],
    "correct_answer": "A",
    "explanation": "Volume adalah \"fuel\" untuk price movement. Breakout valid butuh volume di atas average (idealnya 1.5-2x atau lebih). Low volume breakout = kurang buyers = mudah reversed. Institutional money biasanya terlihat dari volume spike. Rule of thumb: \"Volume precedes price\" - cari volume surge sebelum atau saat breakout.",
    "hints": [
      "Volume = partisipasi = conviction",
      "High volume breakout = real, low volume = suspicious",
      "Always check volume bar di chart saat ada breakout"
    ]
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Indicator Challenge 5: Bollinger Bands Squeeze
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'indicator_005',
  'indicator',
  3,
  'Bollinger Bands Squeeze',
  'Bollinger Bands menyempit drastis (squeeze) setelah periode sideways. Apa yang biasanya terjadi selanjutnya?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Peningkatan volatilitas - breakout besar ke atas atau bawah",
        "correct": true,
        "feedback": "Exactly right! Bollinger Bands Squeeze menandakan volatilitas sangat rendah (consolidation). Seperti pegas yang dikompresi, market cenderung explode dengan volatilitas tinggi setelah squeeze. Arah breakout unpredictable, tapi magnitude biasanya besar. Trading strategy: tunggu breakout, konfirmasi dengan volume, lalu follow trend."
      },
      {
        "id": "B",
        "text": "Sideways berlanjut - tidak ada perubahan signifikan",
        "correct": false,
        "feedback": "Kebalikan dari yang biasa terjadi. Squeeze adalah calm before the storm. Historical data menunjukkan volatility expansion hampir selalu mengikuti squeeze."
      },
      {
        "id": "C",
        "text": "Market crash - squeeze selalu bearish",
        "correct": false,
        "feedback": "Squeeze neutral, bukan bearish. Breakout bisa ke atas (bullish) atau bawah (bearish). Arah ditentukan oleh market forces saat breakout."
      },
      {
        "id": "D",
        "text": "Reversal minor tanpa perubahan trend",
        "correct": false,
        "feedback": "Squeeze biasanya diikuti significant move, bukan minor reversal. Magnitude pergerakan setelah squeeze proporsional dengan durasi squeeze."
      }
    ],
    "correct_answer": "A",
    "explanation": "Bollinger Bands Squeeze adalah salah satu setup paling powerful. Bands menyempit = volatilitas rendah (consolidation). Bands melebar = volatilitas tinggi (trending). Squeeze → Expansion cycle ini predictable. Trading tips: (1) Ukur width bands, (2) Tunggu close di luar bands, (3) Konfirmasi dengan volume, (4) Target = lebar bands x2-3 dari breakout point.",
    "hints": [
      "Volatility cycles: low → high → low",
      "Squeeze = coiled spring ready to release",
      "Tunggu breakout DENGAN volume untuk konfirmasi"
    ]
  }'::jsonb,
  200
) on conflict (id) do nothing;

-- Indicator Challenge 6: VWAP
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'indicator_006',
  'indicator',
  3,
  'VWAP (Volume Weighted Average Price)',
  'Harga trading di bawah VWAP sepanjang hari. Apa interpretasi yang paling akurat?',
  '{
    "type": "indicator",
    "options": [
      {
        "id": "A",
        "text": "Selling pressure dominan - buyers pada kerugian rata-rata",
        "correct": true,
        "feedback": "Perfect! VWAP adalah average price weighted by volume. Trading di bawah VWAP berarti most buyers yang entry hari ini underwater (rugi). Ini menunjukkan sellers in control. Institutional traders sering use VWAP sebagai benchmark - buy below VWAP (good price), sell above VWAP (take profit)."
      },
      {
        "id": "B",
        "text": "Strong bullish signal - waktu untuk accumulate",
        "correct": false,
        "feedback": "Price di bawah VWAP adalah bearish, bukan bullish. Meskipun bisa jadi support level, tapi dominasi sellers jelas ketika price consistently below VWAP."
      },
      {
        "id": "C",
        "text": "VWAP tidak relevan - hanya untuk institutional traders",
        "correct": false,
        "feedback": "VWAP sangat relevan untuk all traders! Retail traders bisa gunakan sebagai dynamic support/resistance dan gauge market sentiment intraday."
      },
      {
        "id": "D",
        "text": "Sinyal netral - VWAP hanya reference price",
        "correct": false,
        "feedback": "While VWAP is a reference, position relative to VWAP absolutely matters. Below VWAP = bearish bias, Above VWAP = bullish bias untuk intraday trading."
      }
    ],
    "correct_answer": "A",
    "explanation": "VWAP reset setiap hari dan sangat popular untuk intraday trading. Above VWAP = bullish bias (buyers in profit), Below VWAP = bearish bias (sellers in control). Institutional orders sering target VWAP untuk execution. Trading strategies: (1) Buy dips to VWAP in uptrend, (2) Sell rallies to VWAP in downtrend, (3) Breakout above/below VWAP dengan volume = strong signal.",
    "hints": [
      "VWAP = fair value untuk hari itu",
      "Institutions use as benchmark for execution",
      "Price position relative to VWAP = market sentiment"
    ]
  }'::jsonb,
  200
) on conflict (id) do nothing;
