import os
import random

# Default rates mapping (kg CO2 saved per kg)
DEFAULT_CO2_SAVED = {
    "Plastic": 1.5,
    "Paper": 0.9,
    "Metal": 2.5,
    "Glass": 1.2,
    "Organic": 0.5,
    "E-Waste": 3.2,
    "E-waste": 3.2,
    "Cardboard": 1.0,
    "Trash": 0.1,
    "Recyclable": 1.2,
    "Non-Recyclable": 0.1
}

# Default points configuration for waste classification
DEFAULT_POINTS = {
    "Plastic": 15,
    "Paper": 10,
    "Metal": 20,
    "Glass": 15,
    "Organic": 5,
    "E-Waste": 30,
    "E-waste": 30,
    "Cardboard": 10,
    "Trash": 2,
    "Recyclable": 12,
    "Non-Recyclable": 2
}

CLASSES = ["Plastic", "Paper", "Metal", "Glass", "Organic", "E-Waste", "Cardboard"]

def classify_waste_image(image_path: str) -> dict:
    """
    Simulates AI Waste Classification
    """
    category = random.choice(CLASSES)
    confidence = round(random.uniform(0.85, 0.99), 2)
    estimated_weight = random.randint(100, 800)  # weight in grams

    return {
        "category": category,
        "confidence": confidence,
        "estimated_weight_g": estimated_weight,
        "bounding_box": [50, 50, 300, 300]
    }

def generate_chatbot_response(message: str, language: str = "en") -> str:
    """
    Multilingual eco-assistant responses
    """
    msg = message.lower()

    if "hello" in msg or "hi" in msg or "vanakkam" in msg:
        if language == "ta":
            return "வணக்கம்! EcoReward AI-க்கு உங்களை வரவேற்கிறோம். குப்பைகளை மறுசுழற்சி செய்து புள்ளிகளைப் பெறுங்கள்!"
        return "Hello! Welcome to EcoReward AI. Scan your waste items to earn Eco Points and save the planet!"

    if "plastic" in msg:
        return "Plastic bottles and containers should be washed before recycling to get higher rewards."

    if "point" in msg or "points" in msg:
        return "You can earn points by scanning plastic, metal, glass, and paper waste. Check your dashboard for total rewards!"

    return "I am your EcoReward AI assistant. Upload an image of waste or ask me about recycling tips!"