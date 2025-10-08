import pandas as pd

# Load the CSV
df = pd.read_csv(r'output\phase2_motif_windows.csv')
df['TimeStamp'] = pd.to_datetime(df['TimeStamp'])

print("="*80)
print("VERIFYING TIMESTAMP FREQUENCY")
print("="*80)

# Check motif 5 (the one from your sample)
motif5 = df[df['motif_rank'] == 5].copy()
motif5 = motif5.sort_values('TimeStamp').reset_index(drop=True)

print(f"\nMotif 5 has {len(motif5)} rows")
print(f"\nFirst 15 rows of Motif 5:")
print("-"*80)

for i in range(min(15, len(motif5))):
    row = motif5.iloc[i]
    print(f"Row {i}: {row['TimeStamp']} | time_offset={row['time_offset_minutes']} | Ore={row['Ore']:.4f}")

print("\n" + "="*80)
print("CHECKING TIME DIFFERENCES")
print("="*80)

time_diffs = motif5['TimeStamp'].diff()
print(f"\nTime differences (first 15):")
for i in range(1, min(15, len(motif5))):
    diff = time_diffs.iloc[i]
    print(f"  Row {i-1} to {i}: {diff} ({diff.total_seconds()/60:.1f} minutes)")

# Check if all diffs are 1 minute
all_one_minute = (time_diffs.dropna() == pd.Timedelta(minutes=1)).all()
print(f"\nAll time differences are 1 minute: {all_one_minute}")

if not all_one_minute:
    print("\nNON-1-MINUTE DIFFERENCES FOUND:")
    non_one_min = time_diffs[time_diffs != pd.Timedelta(minutes=1)].dropna()
    for idx, diff in non_one_min.items():
        print(f"  Index {idx}: {diff} ({diff.total_seconds()/60:.1f} minutes)")

print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"Total motifs: {df['motif_rank'].nunique()}")
print(f"Rows per motif: {df.groupby('motif_rank').size().unique()}")
print(f"Window size (from residence time): 120 minutes")
print(f"Expected rows per motif: 120")
print(f"Actual rows per motif: {len(motif5)}")
print(f"Frequency: 1 minute (confirmed: {all_one_minute})")
