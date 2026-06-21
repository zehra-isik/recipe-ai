from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import shutil
import os
import uvicorn

app = FastAPI()

try:
    model = YOLO("best.pt") 
    print("✅ Yapay Zeka Beyni (best.pt) başarıyla yüklendi!")
except Exception as e:
    print(f"⚠️ Hata: {e}")

@app.post("/detect")
async def detect_ingredients(file: UploadFile = File(...)):
    file_location = f"temp_{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    results = model(file_location)
    
    detected_items = []
    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            
            if class_name not in detected_items:
                detected_items.append(class_name)
                
    os.remove(file_location)
    return {"ingredients": detected_items}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)