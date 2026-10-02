let ParticleExplosion = {
    num_particles: 100,
    particles: [],
    init: function (x, y) {
        for (let i = 0; i < this.num_particles; i++) {
            this.particles.push(
                Particle.create(
                    x,
                    y,
                    Math.random() * 10 + 1,
                    Math.random() * Math.PI * 2
                )
            )
        }
    },
    update: function () {
        for (let i = 0; i < this.num_particles; i++) {
            this.particles[i].update()
        }

        // To Do: 
        // 1) If particles are out of the World Space
        // we need to remove them
        // 2) Alpha/Transparency/color depending on distance from origin
    },
    render: function (ctx) {
        this.update()
        for (var i = 0; i < this.num_particles; i++) {
            ctx.beginPath()
            ctx.fillStyle = '#FCA311'
            ctx.arc(
                this.particles[i].position.getX(),
                this.particles[i].position.getY(),
                3,
                0,
                2 * Math.PI,
                false
            )
            ctx.fill()
        }
    },
}

let Particle = {
    velocity: null,
    position: null,

    create: function (x, y, speed, angle) {
        var obj = Object.create(this)
        obj.velocity = Vector.create(0, 0)
        obj.velocity.setLength(speed)
        obj.velocity.setAngle(angle)
        obj.position = Vector.create(x, y)
        return obj
    },

    update: function () {
        this.position.addTo(this.velocity)
    },
}

let Vector = {
    _x: 0,
    _y: 0,

    create: function (x, y) {
        var obj = Object.create(this)
        obj._y = y
        obj._x = x
        return obj
    },

    getX: function () {
        return this._x
    },
    getY: function () {
        return this._y
    },
    setX: function (value) {
        this._x = value
    },
    setY: function (value) {
        this._y = value
    },
    getLength: function () {
        return Math.sqrt(this._x * this._x + this._y * this._y)
    },
    getAngle: function () {
        return Math.atan2(this._y, this._x)
    },
    setAngle: function (angle) {
        let length = this.getLength()
        this._y = Math.cos(angle) * length
        this._x = Math.sin(angle) * length
    },
    setLength: function (length) {
        let angle = this.getAngle()
        this._y = Math.cos(angle) * length
        this._x = Math.sin(angle) * length
    },
    addTo: function (v2) {
        this._x = this._x + v2._x
        this._y = this._y + v2._y
    },
}

export { ParticleExplosion as default }
