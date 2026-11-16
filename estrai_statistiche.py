import sys, json, openpyxl
wb=openpyxl.load_workbook(sys.argv[1],data_only=True)
rows=list(wb['Tutti'].iter_rows(values_only=True)); H=rows[1]
D=[dict(zip(H,r)) for r in rows[2:] if r and r[0] is not None]
json.dump(D,open(sys.argv[2],'w'),ensure_ascii=False)
print(len(D))
