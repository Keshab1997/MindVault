// 🔥 DuckDuckGo AI - সম্পূর্ণ ফ্রি, কোনো API Key লাগে না
// Simple text processing fallback system

export async function askAI(taskType, text) {
    if (!text || text.trim().length < 5) {
        throw new Error("লেখাটি খুবই ছোট!");
    }

    try {
        const response = await fetch('https://duckduckgo.com/duckchat/v1/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-vqd-accept': '1'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: getPrompt(taskType, text) }]
            })
        });

        if (!response.ok) throw new Error("AI Busy");
        
        const data = await response.json();
        return data.message || processWithFallback(taskType, text);
    } catch (error) {
        console.warn('AI service temporarily unavailable, using fallback');
        throw new Error("🤖 AI বর্তমানে ব্যস্ত আছে। কিছুক্ষণ পর চেষ্টা করুন।");
    }
}

function getPrompt(taskType, text) {
    switch (taskType) {
        case 'summary':
            return `Summarize in 3 bullet points: ${text}`;
        case 'grammar':
            return `Fix grammar: ${text}`;
        case 'tags':
            return `Generate 5 hashtags for: ${text}`;
        default:
            return text;
    }
}

function processWithFallback(taskType, text) {
    switch (taskType) {
        case 'summary':
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            return sentences.slice(0, 3).map(s => `• ${s.trim()}`).join('\n');
        
        case 'grammar':
            return text.replace(/\s+/g, ' ').trim();
        
        case 'tags':
            const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
            const uniqueWords = [...new Set(words)];
            return uniqueWords.slice(0, 5).map(w => `#${w}`).join(' ');
        
        default:
            return text;
    }
}