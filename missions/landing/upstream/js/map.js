import CollisionDetector from './collisions.js'

let Map = {
    steps: 0,
    min_height: 0,
    max_height: 0,
    landing_zone_width: 0,
    landing_zone_position: 0,
    landing_zone_height: 0,
    map: [],
    landing_range: [0, 0], // Range in the X coordinate
    generate: function (steps, width, max_height, min_height) {
        this.steps = steps
        this.max_height = max_height
        this.min_height = min_height
        this.landing_zone_width = 1
        this.landing_zone_position = Math.floor(
            Math.random() * (steps - this.landing_zone_width)
        )
        this.landing_zone_height =
            Math.random() * (max_height - min_height) + min_height

        const delta_x = width / this.steps

        this.map = [[0, max_height]]
        for (let i = 0; i < steps; i++) {
            // Landing zone
            if (
                i >= this.landing_zone_position &&
                i <= this.landing_zone_position + this.landing_zone_width
            ) {
                this.map.push([delta_x * (i + 1), this.landing_zone_height])
            } else {
                this.map.push([
                    delta_x * (i + 1),
                    Math.random() * (max_height - min_height) + min_height,
                ])
            }
        }

        return this.map
    },
    getMap: function () {
        return this.map
    },
    isLanderLandedInRightPosition: function (x) {
        const range = this.getLandingRange()
        if (x >= range[0] && x <= range[1]) return true
        else return false
    },
    getLandingRange: function () {
        return [
            this.map[this.landing_zone_position + 1][0],
            this.map[this.landing_zone_position + 1 + this.landing_zone_width][0],
        ]
    },
    render: function (ctx, width, height) {
        // Rendering the mountains
        ctx.fillStyle = '#737373'
        ctx.strokeStyle = '#FFF'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(this.map[0][0], this.map[0][1])
        for (let i = 1; i < this.map.length; i++) {
            ctx.lineTo(this.map[i][0], this.map[i][1])
        }
        ctx.lineTo(width, height)
        ctx.lineTo(this.map[0][0], height)
        ctx.lineTo(this.map[0][0], this.map[0][1])
        ctx.stroke()
        ctx.fill()

        // Rendering the Landing zone
        ctx.beginPath()
        ctx.strokeStyle = '#FCA311'
        ctx.lineWidth = 4
        ctx.moveTo(
            this.map[this.landing_zone_position + 1][0],
            this.map[this.landing_zone_position + 1][1] - 1
        )
        for (
            let i = this.landing_zone_position;
            i <= this.landing_zone_position + this.landing_zone_width;
            i++
        ) {
            ctx.lineTo(this.map[i + 1][0], this.map[i + 1][1] - 1)
        }
        ctx.stroke()
    },
}

export { Map as default }
