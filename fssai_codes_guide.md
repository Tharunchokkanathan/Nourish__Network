# FSSAI Code Guide — Nourish Network Prototype

## 🔢 How to Decode / Write Your FSSAI Code

All FSSAI numbers are exactly **14 digits** in this format:

```
[ T ][ SS ][ YY ][ OOO ][ SSSSSS ]
  1    2     2      3        6      =  14 digits total
```

| Position | Digits | Meaning | Values |
|----------|--------|---------|--------|
| **T** | 1 | **License Type** | `1` = Licensed Business, `2` = Basic Registered |
| **SS** | 2–3 | **State Code** | `33` = Tamil Nadu, `29` = Karnataka… (see table below) |
| **YY** | 4–5 | **Registration Year** | `24` = 2024, `25` = 2025, `26` = 2026 |
| **OOO** | 6–8 | **District / Officer Code** | `001` = Chennai, `002` = Coimbatore… (see TN table) |
| **SSSSSS** | 9–14 | **Unique Serial Number** | Any 6 digits, e.g. `000001` |

---

## 🗺️ State Codes

| State | Code | Example FSSAI (2026, Licensed) |
|-------|------|-------------------------------|
| **Tamil Nadu** | `33` | `13326001000001` |
| Karnataka | `29` | `12926001000001` |
| Kerala | `32` | `13226001000001` |
| Andhra Pradesh | `28` | `12826001000001` |
| Telangana | `36` | `13626001000001` |
| Maharashtra | `27` | `12726001000001` |
| Delhi | `07` | `10726001000001` |
| Gujarat | `24` | `12426001000001` |
| Rajasthan | `08` | `10826001000001` |
| Uttar Pradesh | `09` | `10926001000001` |
| West Bengal | `19` | `11926001000001` |
| Punjab | `03` | `10326001000001` |
| Haryana | `06` | `10626001000001` |
| Madhya Pradesh | `23` | `12326001000001` |
| Odisha | `21` | `12126001000001` |
| Assam | `18` | `11826001000001` |
| Goa | `30` | `13026001000001` |
| Puducherry | `34` | `13426001000001` |

---

## 🏙️ Tamil Nadu Cities (District Codes)

All TN codes start with `133` (Type `1`, State `33`):

| City / District | District Code | Full FSSAI (2026, Licensed) |
|-----------------|---------------|-----------------------------|
| **Chennai** | `001` | `13326001000001` |
| **Coimbatore** | `002` | `13326002000001` |
| **Madurai** | `003` | `13326003000001` |
| **Trichy** (Tiruchirappalli) | `004` | `13326004000001` |
| **Salem** | `005` | `13326005000001` |
| **Tirunelveli** | `006` | `13326006000001` |
| **Vellore** | `007` | `13326007000001` |
| **Erode** | `008` | `13326008000001` |
| **Thanjavur** | `009` | `13326009000001` |
| **Kancheepuram** | `010` | `13326010000001` |
| **Tiruppur** | `011` | `13326011000001` |
| **Nagercoil** | `012` | `13326012000001` |
| **Dindigul** | `013` | `13326013000001` |
| **Cuddalore** | `014` | `13326014000001` |
| **Thoothukudi (Tuticorin)** | `015` | `13326015000001` |

---

## ✍️ How to Write Your Own Code (Formula)

```
Your Code = [Type][State Code][Year][District Code][Any 6-digit serial]
```

### Example — Chennai, 2025, Licensed Food Business:
```
1  +  33  +  25  +  001  +  000001
= 13325001000001  ✓
```

### Example — Coimbatore, 2026, Basic Registered Operator:
```
2  +  33  +  26  +  002  +  000042
= 23326002000042  ✓
```

### Example — Karnataka (Bengaluru), 2024, Licensed:
```
1  +  29  +  24  +  001  +  000099
= 12924001000099  ✓
```

---

## ✅ Quick Test Codes (Copy-Paste Ready)

| Label | Code | What it represents |
|-------|------|--------------------|
| **TN Chennai** | `13326001000001` | Licensed, Tamil Nadu, Chennai, 2026 |
| **TN Coimbatore** | `13326002000001` | Licensed, Tamil Nadu, Coimbatore, 2026 |
| **TN Madurai** | `13326003000001` | Licensed, Tamil Nadu, Madurai, 2026 |
| **TN Trichy** | `13326004000001` | Licensed, Tamil Nadu, Trichy, 2026 |
| **TN Salem** | `13326005000001` | Licensed, Tamil Nadu, Salem, 2026 |
| **Karnataka** | `12926001000001` | Licensed, Karnataka, 2026 |
| **Kerala** | `13226001000001` | Licensed, Kerala, 2026 |
| **Andhra Pradesh** | `12826001000001` | Licensed, Andhra Pradesh, 2026 |
| **Telangana** | `13626001000001` | Licensed, Telangana, 2026 |
| **Maharashtra** | `12726001000001` | Licensed, Maharashtra, 2026 |
| **Delhi** | `10726001000001` | Licensed, Delhi, 2026 |
| **Basic TN (Street Vendor)** | `23326001000001` | *Basic Registration*, TN, Chennai, 2026 |

---

## ⚠️ Year Restriction in This Prototype

Valid years: **2010 → 2027** (digits 4–5 must be `10` to `27`)

❌ `12345678910111` fails because digits 4–5 = `45` = year 2045 (future)
✅ `13326001000001` passes — year `26` = 2026
