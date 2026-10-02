let canvas = null

import Game from './game.js'
import DOM from './dom.js'

window.onload = function () {
    canvas = document.getElementById('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight - 50
    canvas.style.margin = 'auto'

    const welcome_elem = DOM.get('welcome')
    DOM.show(welcome_elem)
    DOM.hide(DOM.get('gameover'))
    
    welcome_elem.addEventListener("click", function(e) {
        if(e.target.tagName == "BUTTON") {
            Game.init(canvas, 60, e.target.id)
            DOM.hide(welcome_elem)
        } 
    })
    
}
