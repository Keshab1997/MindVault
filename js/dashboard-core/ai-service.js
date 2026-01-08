import { GEMINI_API_KEY } from "./constants.js";

// 🔥 ফিক্স: মডেল নাম পরিবর্তন করে 'gemini-pro' করা হয়েছে যা সবার জন্য কাজ করে
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

export async function askAI(taskType, text) {
    if (!text || text.trim().length < 3) {
        throw new Error("Text is too short for AI processing.");
    }

    let prompt = "";

    // প্রম্পট ইঞ্জিনিয়ারিং (AI কে কি করতে হবে তা বলা)
    switch (taskType) {
        case 'summary':
            prompt = `Summarize the following text in 3 concise bullet points. Keep the language same as the input text:\n\n${text}`;
            break;
        case 'grammar':
            prompt = `Fix grammar, spelling errors, and improve the flow of the following text. Keep the tone professional. Return ONLY the corrected text, nothing else:\n\n${text}`;
            break;
        case 'tags':
            prompt = `Generate 5 relevant hashtags for the following text. Return ONLY the hashtags separated by spaces (e.g. #work #idea):\n\n${text}`;
            break;
        default:
            throw new Error("Invalid AI task.");
    }

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            // এরর ডিবাগ করার জন্য কনসোলে প্রিন্ট করা হলো
            console.error("AI API Error Details:", err);
            throw new Error(err.error?.message || "AI Request Failed");
        }

        const data = await response.json();
        
        // সেফটি চেক
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text.trim();
        } else {
            throw new Error("AI could not generate a response.");
        }

    } catch (error) {
        console.error("AI Service Error:", error);
        throw error;
    }
}