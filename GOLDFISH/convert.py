import base64

img_path = r"C:\Users\iniya\.gemini\antigravity-ide\brain\154945b4-57bf-4f91-a070-be4c915b8053\goldfish_reference_1786870404053.png"

with open(img_path, 'rb') as f:
    data = base64.b64encode(f.read()).decode('utf-8')

out_js = r"c:\Users\iniya\OneDrive\Desktop\NEW 19\goldfish_data.js"
with open(out_js, 'w') as f:
    f.write('const GOLDFISH_BASE64 = "data:image/png;base64,' + data + '";\n')

out_png = r"c:\Users\iniya\OneDrive\Desktop\NEW 19\goldfish.png"
with open(img_path, 'rb') as f_in:
    with open(out_png, 'wb') as f_out:
        f_out.write(f_in.read())

print("SUCCESSFULLY CONVERTED AND SAVED BOTH PNG AND BASE64")
