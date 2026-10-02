import Config from './config.js'
import DOM from './dom.js'
import Lander from './lander.js'
import Map from './map.js'
import Starfield from './starfield.js'
import Stats from './stats.module.js'

let Game = {
    init: function (canvas, fps, level) {
        DOM.set(DOM.get('level'), level)
        this.canvas = canvas
        this.ctx = this.canvas.getContext('2d')

        this.gameover = false

        Map.generate(
            30,
            this.canvas.width,
            this.canvas.height * 0.99,
            this.canvas.height * 0.7
        )
        this.starfield = new Starfield(
            this.ctx,
            80,
            this.canvas.width,
            this.canvas.height
        )

        Lander.init(
            200,
            200,
            this.canvas.width,
            this.canvas.height,
            Config[level]
        )

        // Game Loop
        this.now = 0
        this.dt = 0
        this.last = this.timestamp()
        this.fps = fps
        this.slow = 1
        this.step = 1 / this.fps
        this.slowStep = this.slow * this.step

        // FPS
        this.stats = new Stats()
        this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(this.stats.dom)

        window.requestAnimationFrame(this.frame.bind(this))
    },

    frame: function () {
        this.stats.begin()
        this.now = this.timestamp()
        this.dt += Math.min(1, (this.now - this.last) / 1000)

        while (this.dt > this.slowStep) {
            this.dt -= this.slowStep
            this.update(this.step)
        }

        this.render(this.dt / this.slow)

        this.last = this.now

        this.stats.end()
        window.requestAnimationFrame(this.frame.bind(this))
    },

    timestamp: function () {
        return performance.now()
    },

    update: function (dt) {
        this.starfield.move()

        if (!this.gameover) {
            Lander.updatePosition(dt)

            if (Lander.isCrashed()) this.gameOver(false)

            if (Lander.isLanded()) this.gameOver(true)
        }
    },

    render: function (dt) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.starfield.render()

        Map.render(this.ctx, this.canvas.width, this.canvas.height)
        Lander.render(this.ctx)

        // UI
        DOM.set(
            DOM.get('velocity'),
            'Velocity:' + Lander.getVelocityModule().toFixed(2)
        )
        DOM.set(
            DOM.get('angle'),
            'Angle:' + Lander.getCurrentAngle().toFixed(2)
        )
        DOM.set(DOM.get('fuel'), 'Fuel:' + Lander.getFuel())
    },

    gameOver: function (result) {
        this.gameover = true
        let msg = '<h1>Game Over</h1>'
        msg += '<p>'
        msg += result ? 'You Landed!' : 'You crashed!'
        msg += '</p>'
        const gameover_elem = DOM.get('gameover')
        DOM.set(gameover_elem, msg)
        DOM.addClassName(gameover_elem, result ? 'win' : 'lose')
        DOM.show(gameover_elem)
    },
}

export { Game as default }
