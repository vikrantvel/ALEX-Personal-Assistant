// Simulate the visualizer engine calculations to detect hidden errors!
const activeVehicles = [
    { type: "car", vertices: [{x:0, y:0, z:0}], edges: [], x: 0, y: 0, z: 0 },
    { type: "motorcycle", vertices: [{x:0, y:0, z:0}], edges: [], x: 0, y: 0, z: 0 },
    { type: "man", vertices: [{x:0, y:0, z:0}], edges: [], x: 0, y: 0, z: 0 },
    { type: "tower", vertices: [{x:0, y:0, z:0}], edges: [], x: 0, y: 0, z: 0 }
];

const holoSimState = {
    envs: { road: true, terrain: false, desert: false, water: false },
    time: 0.1,
    speed: 1.0
};

// Paste height formulas
const getTerrainHeight = (x, z) => {
    let h = -0.65;
    const absX = Math.abs(x);
    
    const M = Math.max(3, activeVehicles.length);
    const laneWidth = 1.35;
    const totalWidth = (M - 1) * laneWidth;
    const roadHalfWidth = totalWidth / 2 + 0.8;
    const valleyHalfWidth = holoSimState.envs.road ? roadHalfWidth + 0.15 : 0.85;
    
    if (absX > valleyHalfWidth) {
        const rise = absX - valleyHalfWidth;
        h += rise * 0.85 + Math.sin(x * 6.5 + z * 3.5) * 0.18 + Math.cos(x * 4.0) * 0.08;
    } else if (holoSimState.envs.water && !holoSimState.envs.road) {
        h += Math.sin(x * 5.0 + holoSimState.time * 1.8) * 0.045 + Math.cos(z * 4.5 + holoSimState.time * 1.4) * 0.035;
    }
    return h;
};

const getDuneHeight = (x, z) => {
    return -0.55 + Math.sin(x * 1.5 + z * 1.2 + holoSimState.time * 0.3) * 0.08 + Math.cos(x * 0.6) * 0.06;
};

const getWaterHeight = (x, z) => {
    return -0.55 + Math.sin(x * 5.0 + holoSimState.time * 1.8) * 0.06 + Math.cos(z * 4.5 + holoSimState.time * 1.4) * 0.05;
};

const getSurfaceHeight = (x, z) => {
    const M = Math.max(3, activeVehicles.length);
    const laneWidth = 1.35;
    const totalWidth = (M - 1) * laneWidth;
    const roadHalfWidth = totalWidth / 2 + 0.8;
    
    let rawHeight = -0.55;
    if (holoSimState.envs.terrain) {
        rawHeight = getTerrainHeight(x, z);
    } else if (holoSimState.envs.desert) {
        rawHeight = getDuneHeight(x, z);
    } else if (holoSimState.envs.water) {
        rawHeight = getWaterHeight(x, z);
    }
    
    if (holoSimState.envs.road) {
        const absX = Math.abs(x);
        if (absX < roadHalfWidth) {
            return -0.52;
        } else if (absX < roadHalfWidth + 0.15) {
            const t = (absX - roadHalfWidth) / 0.15;
            return -0.52 + t * (rawHeight - (-0.52));
        }
    }
    
    return rawHeight;
};

try {
    console.log("Simulating height calculation at center x=0, z=0:");
    console.log(getSurfaceHeight(0, 0));
    
    console.log("Simulating height calculation at margin x=3, z=0:");
    console.log(getSurfaceHeight(3, 0));
    
    console.log("Simulating ground-clamping for each vehicle:");
    activeVehicles.forEach((vehicle, idx) => {
        let minY = 0;
        const numVerts = vehicle.vertices.length;
        for (let i = 0; i < numVerts; i++) {
            const v = vehicle.vertices[i];
            if (v.y < minY) minY = v.y;
        }
        const groundH = getSurfaceHeight(vehicle.x, vehicle.z);
        vehicle.y = groundH - minY;
        console.log(`  - ${vehicle.type} y position: ${vehicle.y}`);
    });
    console.log("Simulation SUCCESS!");
} catch (e) {
    console.error("Simulation FAILED with error:", e);
}
