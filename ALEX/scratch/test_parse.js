const entityTypeMap = {
    "truck": "truck", "semi": "truck",
    "motorcycle": "motorcycle", "bike": "motorcycle",
    "bus": "bus",
    "suv": "suv", "jeep": "suv",
    "hovercraft": "hovercraft",
    "spaceship": "spaceship",
    "car": "car", "vehicle": "car",
    "man": "man", "men": "man", "guy": "man", "male": "man",
    "woman": "woman", "women": "woman", "lady": "woman", "female": "woman",
    "boy": "boy", "boys": "boy",
    "girl": "girl", "girls": "girl",
    "child": "boy", "kid": "boy", "children": "boy", "kids": "boy",
    "person": "man", "human": "man", "people": "man",
    "pedestrian": "man", "walker": "man"
};

function test(query) {
    const clean = query.toLowerCase();
    const foundTypes = [];
    const seenTypes = new Set();
    for (const [keyword, typeName] of Object.entries(entityTypeMap)) {
        const regex = new RegExp("\\b" + keyword + "s?\\b", "i");
        if (regex.test(clean) && !seenTypes.has(typeName)) {
            seenTypes.add(typeName);
            foundTypes.push(typeName);
        }
    }
    console.log(`Query: "${query}" -> foundTypes:`, foundTypes);
}

test("a car");
test("suv");
test("a woman");
test("a vehicle running");
test("car");
test("woman");
test("women");
test("a man and woman");
