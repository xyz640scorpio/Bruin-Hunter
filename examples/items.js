import { defs, tiny } from './common.js';

const {
    Vector, Vector3, vec, vec3, vec4, hex_color, Matrix, Mat4,
    Light, Shape, Material, Shader, Texture, Scene
} = tiny;


const items = {};

export {tiny, defs, items};

const OBJECT_TYPE = {
    WALL: 1,
    PACMAN: 2,
    GHOST: 3,
}

const WALL_WIDTH = 1;
const PACMAN_SPEED = 2;
const PACMAN_RADIUS = 0.25;
const GHOST_SPEED = 1.5;
const GHOST_RADIUS = 0.25 * 1.25;
const DOT_RADIUS = 0.05;
items.exports = {OBJECT_TYPE, PACMAN_SPEED, PACMAN_RADIUS, WALL_WIDTH}

const MusicPlayer = items.MusicPlayer =
    class MusicPlayer {
        constructor() {
            this.start_sound = new Audio('./audio/pacman_beginning.mp3');
            this.start_sound.preload = 'auto';

            this.chomp_sound = new Audio('./audio/pacman_chomp.mp3');
            this.chomp_sound.loop = true;
            this.chomp_sound.preload = 'auto';

            this.death_sound = new Audio('./audio/pacman_death.mp3');
            this.death_sound.preload = 'auto';

            this.eat_sound = new Audio('./audio/pacman_eatghost.mp3');
            this.eat_sound.preload = 'auto';

            this.day_mode = new Audio('./audio/day_mode.mp3');
            this.day_mode.loop = true;
            this.day_mode.preload = 'auto';

            this.twilight_mode = new Audio('./audio/twilight_mode.mp3');
            this.twilight_mode.loop = true;
            this.twilight_mode.preload = 'auto';

            this.nightmare_mode = new Audio('./audio/nightmare_mode.mp3');
            this.nightmare_mode.loop = true;
            this.nightmare_mode.preload = 'auto';
        }

        play_background_sound(mode = 1) {
            if (mode === 0) {
                this.day_mode.play();
            } else if (mode === 1) {
                this.twilight_mode.play();
            } else if (mode === 2) {
                this.nightmare_mode.play();
            }
        }

        pause_background_sound(mode = 1) {
            if (mode === 0) {
                this.day_mode.pause();
            } else if (mode === 1) {
                this.twilight_mode.pause();
            } else if (mode === 2) {
                this.nightmare_mode.pause();
            }
        }
    }

const VecHelper = items.VecHelper =
    class VecHelper {
        static round_vec3(v) {
            v[0] = Math.round(v[0]);
            v[1] = Math.round(v[1]);
            v[2] = Math.round(v[2]);
        }
    }
const round_vec3 = items.round_vec3 = VecHelper.round_vec3;
const Wall = items.Wall =
    class Wall {
        constructor(parameters) {
            this.type = OBJECT_TYPE.WALL;
            this.width = WALL_WIDTH;
            this.color = hex_color("#0000FF");
            this.ambient = 0.9;
            this.shape = new defs.Cube();
            Object.assign(this, parameters);
            this.material = new Material(new defs.Phong_Shader(),
                {ambient: this.ambient, color: this.color });
        }

        draw(context, program_state, position, direction=undefined) {
            let transform = Mat4.identity();
            transform = transform
                .times(Mat4.translation(position[0], position[1], position[2]))
                .times(Mat4.scale(this.width/2, this.width/2, this.width/2));
            if (direction) {
                transform = transform.times(direction);
            }
            this.shape.draw(context, program_state, transform, this.material);
            return transform;
        }
    }

const Ghost = items.Ghost =
    class Ghost {
        constructor(parameters) {
            this.type = OBJECT_TYPE.GHOST;
            this.speed = GHOST_SPEED;
            this.radius = GHOST_RADIUS;
            this.ambient = 0.9;
            this.color = hex_color("#FF0000");
            this.shape = new defs.Subdivision_Sphere(4),
            Object.assign(this, parameters);
            this.material = new Material(new defs.Phong_Shader(),
                {ambient: this.ambient, color: this.color });
        }

        draw(context, program_state, position, direction = undefined) {
            let transform = Mat4.identity();
            transform = transform
                .times(Mat4.translation(position[0], position[1], position[2]))
                .times(Mat4.scale(this.radius, this.radius, this.radius));
            if (direction) {
                transform = transform.times(direction);
            }
            this.shape.draw(context, program_state, transform, this.material);
            return transform;
        }
    }

const Dot = items.Dot =
    class Dot {
        constructor(parameters) {
            this.radius = DOT_RADIUS;
            this.color = hex_color("#60A04C");
            this.shape = new defs.Subdivision_Sphere(4),
            Object.assign(this, parameters);
        }
    }

const DEFAULT_MAP_LIST = [
    '# # # # # # # # # # # # # # # # # # # # # # # # # # # #',
    '# . . . . . . . . . . . . # # . . . . . . . . . . . . #',
    '# . # # # # . # # # # # . # # . # # # # # . # # # # . #',
    '# o # # # # . # # # # # . # # . # # # # # . # # # # o #',
    '# . # # # # . # # # # # . # # . # # # # # . # # # # . #',
    '# . . . . . . . . . . . . . . . . . . . . . . . . . . #',
    '# . # # # # . # # . # # # # # # # # . # # . # # # # . #',
    '# . # # # # . # # . # # # # # # # # . # # . # # # # . #',
    '# . . . . . . # # . . . . # # . . . . # # . . . . . . #',
    '# # # # # # . # # # # #   # #   # # # # # . # # # # # #',
    '          # . # # # # #   # #   # # # # # . #          ',
    '          # . # #         G           # # . #          ',
    '          # . # #   # # # # # # # #   # # . #          ',
    '# # # # # # . # #   #             #   # # . # # # # # #',
    '          # .       #             #       . #          ',
    '# # # # # # . # #   #             #   # # . # # # # # #',
    '          # . # #   # # # # # # # #   # # . #          ',
    '          # . # #                     # # . #          ',
    '          # . # #   # # # # # # # #   # # . #          ',
    '# # # # # # . # #   # # # # # # # #   # # . # # # # # #',
    '# . . . . . . . . . . . . # # . . . . . . . . . . . . #',
    '# . # # # # . # # # # # . # # . # # # # # . # # # # . #',
    '# . # # # # . # # # # # . # # . # # # # # . # # # # . #',
    '# o . . # # . . . . . . . P   . . . . . . . # # . . o #',
    '# # # . # # . # # . # # # # # # # # . # # . # # . # # #',
    '# # # . # # . # # . # # # # # # # # . # # . # # . # # #',
    '# . . . . . . # # . . . . # # . . . . # # . . . . . . #',
    '# . # # # # # # # # # # . # # . # # # # # # # # # # . #',
    '# . # # # # # # # # # # . # # . # # # # # # # # # # . #',
    '# . . . . . . . . . . . . . . . . . . . . . . . . . . #',
    '# # # # # # # # # # # # # # # # # # # # # # # # # # # #'
];
const DEBUG_MAP_LIST = [
    '# # # # # # #',
    '# G . # . . #',
    '# . . . . . #',
    '# . . # . P #',
    '# # # # # # #',
];
const Map = items.Map =
    class Map {
        constructor(objectPositionList) {
            this.MAP = DEFAULT_MAP_LIST;
            // this.MAP = DEBUG_MAP_LIST;
            this.bottom = -(this.MAP.length - 1);
            this.top = 0;
            this.left = 0;
            this.right = Math.floor(this.MAP[0].length / 2);
            this.centerX = (this.left + this.right) / 2;
            this.centerY = (this.bottom + this.top) / 2;
            this.pacmanBirthplace = null;
            this.ghostBirthplace = null;
            this.positionObjectMap = {};
            for(let row = 0; row < this.MAP.length; row++) {
                let y = -row;
                this.positionObjectMap[y] = {};
                for (let column = 0; column < this.MAP[row].length; column += 2) {
                    let x = Math.floor(column / 2);
                    let positionVec = vec3(x, y, 0);
                    let cell = this.MAP[row][column];
                    if (cell === "#") {
                        let cell = {type: OBJECT_TYPE.WALL, position: positionVec};
                        this.positionObjectMap[y][x] = cell;
                        objectPositionList.push(cell);
                    } else if (cell === "P") {
                        this.pacmanBirthplace = positionVec;
                    } else if (cell === "G") {
                        this.ghostBirthplace = positionVec;
                    }
                }
            }
        }

        isWall(position, x = undefined, y = undefined) {
            if (position) {
                x = Math.round(position[0]);
                y = Math.round(position[1]);
            }
            let cell = undefined;
            if (this.positionObjectMap[y] && this.positionObjectMap[y][x]) {
                cell = this.positionObjectMap[y][x];
            }
            if (!cell || cell.type !== OBJECT_TYPE.WALL) {
                return false;
            }
            return true;
        }
    }

