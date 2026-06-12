import pandas as pd

# Load the motif windows CSV
df = pd.read_csv(r'c:\Projects\ok_dashboard\python\mills-xgboost\app\optimization_cascade\tests\steady_state_tests\output\phase2_motif_windows.csv')

print(f'Total rows: {len(df)}')
print(f'\nDataFrame info:')
print(df.info())

print(f'\n{"="*80}')
print('TIMESTAMP ANALYSIS')
print("="*80)

# Convert to datetime
df['TimeStamp'] = pd.to_datetime(df['TimeStamp'])

print(f'\nFirst 20 timestamps:')
print(df['TimeStamp'].head(20).to_list())

print(f'\nLast 20 timestamps:')
print(df['TimeStamp'].tail(20).to_list())

print(f'\n{"="*80}')
print('MOTIF ANALYSIS')
print("="*80)

print(f'\nUnique motif ranks: {sorted(df["motif_rank"].unique())}')
print(f'\nRows per motif:')
print(df.groupby('motif_rank').size())

print(f'\n{"="*80}')
print('CHECKING FOR GAPS IN TIMESTAMPS')
print("="*80)

# Check time differences
df_sorted = df.sort_values('TimeStamp')
time_diffs = df_sorted['TimeStamp'].diff()

print(f'\nTime difference statistics:')
print(time_diffs.describe())

print(f'\nUnique time differences (in minutes):')
unique_diffs = time_diffs.dropna().unique()
for diff in sorted(unique_diffs):
    count = (time_diffs == diff).sum()
    print(f'  {diff} ({diff.total_seconds()/60:.0f} min): {count} occurrences')

print(f'\n{"="*80}')
print('SAMPLE DATA FROM EACH MOTIF')
print("="*80)

for motif_rank in sorted(df['motif_rank'].unique()):
    motif_data = df[df['motif_rank'] == motif_rank]
    print(f'\nMotif {motif_rank}:')
    print(f'  Start: {motif_data["TimeStamp"].min()}')
    print(f'  End: {motif_data["TimeStamp"].max()}')
    print(f'  Rows: {len(motif_data)}')
    print(f'  First 5 timestamps: {motif_data["TimeStamp"].head(5).to_list()}')
