import * as constants from './config.js'
import CollisionDetector from './collisions.js'
import ParticleExplosion from './particle_explosion.js'
import Map from './map.js'

window.addEventListener(
    'keydown',
    function (ev) {
        return Lander.onkey(ev.keyCode, true)
    },
    false
)
window.addEventListener(
    'keyup',
    function (ev) {
        return Lander.onkey(ev.keyCode, false)
    },
    false
)

const KEY = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
}

let Lander = {
    pressed: {
        left: false,
        right: false,
        up: false,
    },
    init: function (x, y, width, height, config) {
        this.debug = false
        this.x = x
        this.y = y
        this.world_width = width
        this.world_height = height
        this.collision = false
        this.landed = false
        this.crashed = false
        this.particle_explosion = null

        this.fuel = config.fuel

        // Geometry
        this.points = [
            [0, -2],
            [-1, 2],
            [1, 2],
        ]
        this.thrust_point = [0, 2]
        this.width = 10
        this.height = 10
        this.collider_radius = 15

        // Physics
        this.gravity = config.gravity
        this.thrust_acceleration = config.thrust_acceleration
        this.v = [0, 0]
        this.v_max = config.v_max
        this.v_max_for_landing = config.v_max_for_landing
        this.theta = 0
        this.delta_theta = 0
        this.rotate_acceleration = config.rotate_acceleration
        this.rotata_dumping = 0.75
        this.omega = 0 // ω
    },
    updatePosition: function (dt) {
        // Linear movement
        let thrust = 0
        if (this.fuel > 0 && this.pressed.up) {
            thrust = 1
            this.fuel--
        }

        let net_acceleration_y =
            this.gravity -
            thrust * this.thrust_acceleration * Math.cos(this.theta)
        let net_acceleration_x =
            thrust * this.thrust_acceleration * Math.sin(this.theta)

        this.v[0] += net_acceleration_x * dt
        this.v[1] += net_acceleration_y * dt

        if (this.v[0] > this.v_max) this.v[0] = this.v_max
        if (this.v[0] < -this.v_max) this.v[0] = -this.v_max

        if (this.v[1] > this.v_max) this.v[1] = this.v_max
        if (this.v[1] < -this.v_max) this.v[1] = -this.v_max

        let delta = [this.v[0] * dt, this.v[1] * dt]
        this.move(delta)

        // Rotational movement
        let direction = 0
        if (this.pressed.left) {
            direction = -1
        }
        if (this.pressed.right) {
            direction = 1
        }

        this.omega +=
            direction * this.rotate_acceleration * dt -
            this.rotata_dumping * this.delta_theta
        this.delta_theta = this.omega * dt
        this.theta += this.delta_theta
        this.rotate(this.delta_theta)

        this.checkCollisions()
    },
    move: function (delta) {
        this.x += delta[0]
        this.y += delta[1]
    },
    rotate: function (delta) {
        var temp = 0
        // If I don't use the temp value x is being updated too early,
        // such that y is calculated based on the new value of x instead of the old value.
        const cos_delta = Math.cos(delta)
        const sin_delta = Math.sin(delta)
        for (var point of this.points) {
            temp = cos_delta * point[1] + sin_delta * point[0]
            point[0] = cos_delta * point[0] - sin_delta * point[1]
            point[1] = temp
        }

        // Thrust point
        temp =
            cos_delta * this.thrust_point[1] + sin_delta * this.thrust_point[0]
        this.thrust_point[0] =
            cos_delta * this.thrust_point[0] - sin_delta * this.thrust_point[1]
        this.thrust_point[1] = temp
    },
    onkey: function (key, pressed) {
        switch (key) {
            case KEY.LEFT:
                this.pressed.left = pressed
                break
            case KEY.RIGHT:
                this.pressed.right = pressed
                break
            case KEY.UP:
                this.pressed.up = pressed
                break
            default:
                break
        }
    },
    isOutsideBoundaries: function () {
        if (
            this.x <= 0 ||
            this.x >= this.world_width ||
            this.y <= 0 ||
            this.y >= this.world_height
        ) {
            console.log(this.width, this.height)
            return true
        } else return false
    },
    getVelocityModule: function () {
        return Math.sqrt(this.v[0] * this.v[0] + this.v[1] * this.v[1])
    },
    getCurrentAngle: function () {
        let angle = this.theta * (180 / Math.PI)
        const number_of_rotations = Math.floor(angle / 360)
        return angle - number_of_rotations * 360
    },
    getFuel: function () {
        return this.fuel
    },
    checkCollisions: function () {
        const map = Map.getMap()
        this.collision = false
        const player = {
            x: this.x,
            y: this.y,
            radius: this.collider_radius,
        }

        for (let i = 0; i < map.length - 1; i++) {
            const line = {
                a: { x: map[i][0], y: map[i][1] },
                b: { x: map[i + 1][0], y: map[i + 1][1] },
            }

            if (CollisionDetector.circleLine(player, line))
                this.collision = true
        }

        // Outside boundaries?
        if (this.isOutsideBoundaries()) {
            ParticleExplosion.init(this.x, this.y)
            this.crashed = true
        }

        // Has it crashed?
        if (
            this.collision &&
            this.getVelocityModule() > this.v_max_for_landing
        ) {
            this.crash()
        }

        // Has it landed?
        if (this.collision && this.getVelocityModule() < this.v_max_for_landing)
        {
            if(Map.isLanderLandedInRightPosition(this.x))
            this.landed = true
            else
            this.crash()
        }
    },
    crash: function() {
        ParticleExplosion.init(this.x, this.y)
        this.crashed = true
    },
    isCrashed: function () {
        return this.crashed
    },
    isLanded: function () {
        return this.landed
    },
    render: function (ctx) {
        if (this.crashed) {
            ParticleExplosion.render(ctx)
        } else {
            if (this.fuel > 0 && this.pressed.up) {
                ctx.beginPath()
                ctx.fillStyle = '#f0f043'
                ctx.arc(
                    this.x + this.thrust_point[0] * this.width,
                    this.y + this.thrust_point[1] * this.height,
                    5,
                    0,
                    2 * Math.PI,
                    false
                )
                ctx.fill()
            }
            ctx.fillStyle = '#FCA311'
            ctx.lineWidth = 3
            ctx.beginPath()
            const first_point = this.points[0]
            ctx.moveTo(
                this.x + first_point[0] * this.width,
                this.y + first_point[1] * this.height
            )
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(
                    this.x + this.points[i][0] * this.width,
                    this.y + this.points[i][1] * this.height
                )
            }
            ctx.fill()
        }

        if (this.debug) {
            // Velocity
            ctx.strokeStyle = 'yellow'
            ctx.beginPath()
            ctx.moveTo(this.x, this.y)
            ctx.lineTo(this.v[0] + this.x, this.v[1] + this.y)
            ctx.stroke()

            // Collider
            ctx.strokeStyle = 'red'
            ctx.beginPath()
            ctx.arc(this.x, this.y, this.collider_radius, 0, 2 * Math.PI)
            ctx.stroke()
        }
    },
}

export { Lander as default }
