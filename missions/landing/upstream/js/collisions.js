let CollisionDetector = {
    /**
     * @param {{x: number, y: number}} point
     * @param {{x: number, y: number, radius: number}} circle
     */
    pointCircle: function (point, circle) {
        const dx = point.x - circle.x
        const dy = point.y - circle.y
        const squaredDist = dx * dx + dy * dy

        return squaredDist <= circle.radius * circle.radius ? true : false
    },
    /**
     * @param {{x: number, y: number, radius: number}} circle1
     * @param {{x: number, y: number, radius: number}} circle2
     */
    circleCircle: function (circle1, circle2) {
        const dx = circle1.x - circle2.x
        const dy = circle1.y - circle2.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        return dist <= circle1.radius + circle2.radius ? true : false
    },

    /**
     * @param {{x: number, y: number}} point
     * @param {{x: number, y: number, width: number, height: number}} rectangle
     */
    pointRectangle: function (point, rectangle) {
        if (
            point.x >= rectangle.x &&
            point.x <= rectangle.x + rectangle.width &&
            point.y >= rectangle.y &&
            point.y <= rectangle.y + rectangle.height
        ) {
            return true
        } else {
            return false
        }
    },

    /**
     * @param {{x: number, y: number, width: number, height: number}} rect1
     * @param {{x: number, y: number, width: number, height: number}} rect2
     */
    rectangleRectangle: function (rect1, rect2) {
        if (
            rect1.x + rect1.width >= rect2.x &&
            rect1.x <= rect2.x + rect2.width &&
            rect1.y + rect1.height >= rect2.y &&
            rect1.y <= rect2.y + rect2.height
        ) {
            return true
        } else {
            return false
        }
    },

    /**
     * @param {{x: number, y: number, radius: number}} circle
     * @param {{x: number, y: number, width: number, height: number}} rect
     */
    circleRectangle: function (circle, rect) {
        const cx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width))
        const cy = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height))

        const dx = circle.x - cx
        const dy = circle.y - cy
        const squaredDist = dx * dx + dy * dy
        return squaredDist < circle.radius * circle.radius ? true : false
    },

    /**
     * @param {{a: {x: number, y: number}, b: {x: number, y: number} }} line
     * @param {{x: number, y: number}} point
     */
    linePoint: function (line, point) {
        const buffer = 0.1
        const AB = {
            x: line.b.x - line.a.x,
            y: line.b.y - line.a.y,
        }
        const AC = {
            x: point.x - line.a.x,
            y: point.y - line.a.y,
        }
        const BC = {
            x: point.x - line.b.x,
            y: point.y - line.b.y,
        }

        const ABLen = Math.sqrt(AB.x * AB.x + AB.y * AB.y)
        const ACLen = Math.sqrt(AC.x * AC.x + AC.y * AC.y)
        const BCLen = Math.sqrt(BC.x * BC.x + BC.y * BC.y)

        if (ACLen + BCLen >= ABLen - buffer && ACLen + BCLen <= ABLen + buffer)
            return true
        else return false
    },

    /**
     * @param {{x: number, y: number, radius: number}} circle
     * @param {{a: {x: number, y: number}, b: {x: number, y: number} }} line
     */
    circleLine: function (circle, line) {
        // If either of the ends of the line are inside the circle return true
        if (
            this.pointCircle(line.a, circle) ||
            this.pointCircle(line.b, circle)
        )
            return true

        const AB = {
            x: line.b.x - line.a.x,
            y: line.b.y - line.a.y,
        }
        const ABmagnitude = Math.sqrt(AB.x * AB.x + AB.y * AB.y)
        const normalizedAB = {
            x: AB.x / ABmagnitude,
            y: AB.y / ABmagnitude,
        }

        const AC = {
            x: circle.x - line.a.x,
            y: circle.y - line.a.y,
        }

        let distance = AC.x * normalizedAB.x + AC.y * normalizedAB.y

        if (distance < 0) distance = 0
        if (distance > ABmagnitude) distance = ABmagnitude

        const projection = {
            x: normalizedAB.x * distance + line.a.x,
            y: normalizedAB.y * distance + line.a.y
        }

        return this.pointCircle(projection, circle)
    },
}

export { CollisionDetector as default }
