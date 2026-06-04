const entityTypeMap = {
    "truck": "truck", "semi": "truck",
    "motorcycle": "motorcycle", "bike": "motorcycle",
    "bus": "bus",
    "suv": "suv", "jeep": "suv",
    "hovercraft": "hovercraft",
    "spaceship": "spaceship",
    "car": "car", "vehicle": "car",
    "boat": "boat", "speedboat": "boat", "ship": "boat", "yacht": "boat",
    "man": "man", "men": "man", "guy": "man", "male": "man",
    "woman": "woman", "women": "woman", "lady": "woman", "female": "woman",
    "boy": "boy", "boys": "boy",
    "girl": "girl", "girls": "girl",
    "child": "boy", "kid": "boy", "children": "boy", "kids": "boy",
    "person": "man", "human": "man", "people": "man",
    "pedestrian": "man", "walker": "man",
    "skyscraper": "skyscraper",
    "tower": "tower", "lighthouse": "tower", "obelisk": "tower",
    "pyramid": "pyramid",
    "castle": "castle", "fortress": "castle", "temple": "castle",
    "house": "house", "cottage": "house", "cabin": "house", "home": "house",
    "windmill": "windmill",
    "building": "skyscraper"
};

const numberWords = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "single": 1, "only": 1, "a": 1, "an": 1
};

function test(query) {
    const clean = query.toLowerCase();
    
    // 1. Find all matches and sort by index
    const matches = [];
    const seenTypes = new Set();
    
    for (const [keyword, typeName] of Object.entries(entityTypeMap)) {
        const regex = new RegExp("\\b" + keyword + "s?\\b", "gi");
        let m;
        while ((m = regex.exec(clean)) !== null) {
            matches.push({
                index: m.index,
                length: m[0].length,
                typeName: typeName,
                keyword: keyword
            });
        }
    }
    matches.sort((a, b) => a.index - b.index);
    
    // We want to combine matches that overlap or are duplicates at same index
    const uniqueMatches = [];
    let lastEnd = -1;
    for (const m of matches) {
        if (m.index >= lastEnd) {
            uniqueMatches.push(m);
            lastEnd = m.index + m.length;
        }
    }
    
    console.log(`Query: "${query}"`);
    uniqueMatches.forEach((m, idx) => {
        // Find quantity prefix
        const preStr = clean.substring(Math.max(0, m.index - 15), m.index).trim();
        const numMatch = preStr.match(/(\b\d+\b|\b[a-z]+\b)\s*$/i);
        
        let quantity = 1;
        if (numMatch) {
            const word = numMatch[1];
            if (/^\d+$/.test(word)) {
                quantity = parseInt(word, 10);
            } else if (numberWords[word] !== undefined) {
                quantity = numberWords[word];
            }
        }
        
        console.log(`  - Entity: ${m.typeName} (keyword: "${m.keyword}"), quantity: ${quantity}`);
    });
    console.log("--------------------------------------");
}

test("2 car and 3 man");
test("a car and 5 boys");
test("three windmills and two suvs");
test("ten suvs and one helicopter");
