var Config = {
    EASY: {
        gravity: 20,
        thrust_acceleration: 60,
        rotate_acceleration: 3,
        fuel: 2000,
        v_max: 60,
        v_max_for_landing: 50,
    },
    MEDIUM: {
        gravity: 30,
        thrust_acceleration: 70,
        rotate_acceleration: 5,
        fuel: 1500,
        v_max: 120,
        v_max_for_landing: 25,
    },
    HARD: {
        gravity: 40,
        thrust_acceleration: 80,
        rotate_acceleration: 7,
        fuel: 750,
        v_max: 160,
        v_max_for_landing: 15,
    },
}

export { Config as default }
