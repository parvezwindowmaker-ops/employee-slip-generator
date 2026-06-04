# Salary Slip Generator

Bulk generates PDF salary slips from an Excel attendance/salary sheet.

---

## Folder Structure

```
backend/
├── public/
│   ├── APRIL.xlsx                          ← Input Excel file
│   └── Salary_Slips/
│       └── APRIL-2026/                     ← Output folder (auto-created)
│           ├── DHANANJAYKUMAR.R._PANDEY_Salary_Slip_APRIL-2026.pdf
│           ├── SEETA_BHANJU_SINGH_Salary_Slip_APRIL-2026.pdf
│           └── ... (one PDF per employee)
└── scripts/
    └── generateSlips.js                    ← Main script
```

---

## How to Generate Salary Slips

### Step 1: Place your Excel file

Put the monthly Excel file (e.g., `MAY.xlsx`, `JUNE.xlsx`) inside:

```
backend/public/
```

### Step 2: Update the file path in the script

Open `backend/scripts/generateSlips.js` and change line 7:

```js
const EXCEL_FILE = path.join(__dirname, "..", "public", "APRIL.xlsx");
```

Replace `"APRIL.xlsx"` with your new file name, e.g.:

```js
const EXCEL_FILE = path.join(__dirname, "..", "public", "MAY.xlsx");
```

### Step 3: Run the script

```bash
cd backend
node scripts/generateSlips.js
```

### Step 4: Find your slips

Slips are saved in:

```
backend/public/Salary_Slips/<MONTH>-<YEAR>/
```

For example: `backend/public/Salary_Slips/MAY-2026/`

Each file is named: `Employee_Name_Salary_Slip_MONTH-YEAR.pdf`

---

## What Each Slip Contains

| Section          | Details                                              |
| ---------------- | ---------------------------------------------------- |
| Header           | Company name, "Salary Slip", Month & Year            |
| Employee Info    | Name, Designation, Department, PAN, UAN, Bank A/C    |
| Attendance       | Present Days, Week Off, Total Days                   |
| Earnings         | Basic, HRA, Conveyance, Medical, Special Allowance   |
| Deductions       | PF (12%), ESI (0.75%), PT, TDS, Advance, Meal, etc. |
| Net Salary       | Final amount + amount in words (Indian format)       |

---

## Excel File Requirements

The script expects the Excel format used by **Nandini Herbal Care Pvt. Ltd.** sheets:

- **Sheet 1** is read (first sheet in the workbook)
- **Row 2** should contain the title like `"COMPANY NAME MONTH-YEAR"`
- **Row 4** contains column headers
- **Row 6 onwards** contains employee data

### Key columns used (0-indexed):

| Index | Column                |
| ----- | --------------------- |
| 4     | Group/Department      |
| 5     | Post/Designation      |
| 8     | UAN Number            |
| 9     | SR Number             |
| 10    | PF Status             |
| 11    | Employee Name         |
| 12    | Salary Amount (CTC)   |
| 13    | Basic                 |
| 14    | HRA                   |
| 15    | Conveyance            |
| 16    | Medical               |
| 17    | Special Allowance     |
| 20    | Present Days          |
| 21    | Week Off              |
| 23    | Total Days            |
| 24    | Earned Total          |
| 25    | Other Allowance       |
| 26    | Gross Earnings        |
| 28    | PF Employee (12%)     |
| 30    | ESI Employee (0.75%)  |
| 32    | Professional Tax      |
| 33    | TDS                   |
| 34    | Advance               |
| 35    | Meal                  |
| 36    | Store                 |
| 37    | Other Deduction       |
| 39    | Net Amount            |
| 42    | PAN Card              |
| 43    | Bank Account          |
| 44    | IFSC Code             |

---

## Dependencies

Already installed in `backend/package.json`:

- `xlsx` — reads Excel files
- `pdfkit` — generates PDF documents

If dependencies are missing, run:

```bash
cd backend
npm install xlsx pdfkit
```

---

## Troubleshooting

| Problem                        | Solution                                                  |
| ------------------------------ | --------------------------------------------------------- |
| "ENOENT: no such file"        | Check the Excel file path in `generateSlips.js` line 7    |
| Empty/wrong data in slips     | Verify the Excel format matches the column layout above   |
| "TOTAL" slip generated        | Already handled — script skips rows named "TOTAL"         |
| 0 employees found             | Check that employee names are in column 12 (index 11)     |
