let DOM = {
    get: function (id) {
        return document.getElementById(id)
    },

    set: function (ele, html) {
        ele.innerHTML = html
    },

    hide: function (ele) {
        ele.style.display = 'none'
    },

    show: function (ele) {
        ele.style.display = 'block'
    },

    hasClassName: function (ele, name) {
        return new RegExp('(^|s*)' + name + '(s*|$)').test(ele.className)
    },

    addClassName: function (ele, name) {
        this.toggleClassName(ele, name, true)
    },

    removeClassName: function (ele, name) {
        this.toggleClassName(ele, name, false)
    },

    toggleClassName: function (ele, name, on) {
        var classes = ele.className.split(' ')
        var n = classes.indexOf(name)
        on = typeof on == 'undefined' ? n < 0 : on
        if (on && n < 0) classes.push(name)
        else if (!on && n >= 0) classes.splice(n, 1)
        ele.className = classes.join(' ')
    },
}

export { DOM as default }
