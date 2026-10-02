export default class Starfield {
    constructor(ctx, number_of_stars, width, height) {
        this.ctx = ctx
        this.number_of_stars = number_of_stars
        this.width = width
        this.height = height
        this.speed = 0.5
        this.stars = []

        for (var i = 0; i <= this.number_of_stars; i++) {
            this.stars.push({
                x: Math.floor(Math.random() * this.width),
                y: Math.floor(Math.random() * this.width),
                r: Math.random() * 2 + 1,
                a: Math.random() * 0.5 + 0.5,
            })
        }
    }

    render = function () {
        this.ctx.globalAlpha = 1

        for (var i = 0; i < this.stars.length; i++) {
            var star = this.stars[i]
            var gradient = this.ctx.createRadialGradient(
                star.x,
                star.y,
                0,
                star.x + star.r,
                star.y + star.r,
                star.r * 2
            )
            gradient.addColorStop(0, 'rgba(255, 255, 255, ' + star.a + ')')
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

            this.ctx.beginPath()
            this.ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI)
            this.ctx.fillStyle = gradient
            this.ctx.fill()
        }

        this.ctx.globalAlpha = 1
    }

    move = function () {
        for (var i = 0; i < this.stars.length; i++) {
            var star = this.stars[i]

            var d = star.r * star.a * this.speed

            star.x -= d
            star.x -= this.width * Math.floor(star.x / this.width)
        }
    }
}