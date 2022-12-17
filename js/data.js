/*
 * Parameters n such
 */
export const params = Object.freeze(
    function() {
        const obj = {
            minUnitVelocity: 0.5,
            backgroundColor: "#1f1f1f",
            baseFadeColor: "#101010",
            laneColor: "#888888",
            laneWidth: 60,
            baseRadius: 200,
            baseVisualRadius: 250,
            teamColors: [ "#6f6f6f", "#ff9933", "#3399ff" ], // first one is 'no team'
        }
        obj.laneDistFromBase = obj.baseRadius - 5;
        return obj;
    }()
);