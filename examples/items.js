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

items.exports = {OBJECT_TYPE}

const WALL_WIDTH = 1;
const PACMAN_SPEED = 2;
const PACMAN_RADIUS = 0.25;
const GHOST_SPEED = 1.5;
const GHOST_RADIUS = 0.25 * 1.25;
const DOT_RADIUS = 0.05;
const Wall = items.Wall =
    class Wall {
        constructor(parameters) {
            this.type = OBJECT_TYPE.WALL;
            this.width = WALL_WIDTH;
            this.color = hex_color("#0000FF");
            this.ambient = 1;
            this.shape = new defs.Cube();
            Object.assign(this, parameters);
            this.material = new Material(new defs.Phong_Shader(),
                {ambient: this.ambient, color: this.color });
        }

        draw(context, program_state, position) {
            let transform = Mat4.identity();
            transform = transform
                .times(Mat4.translation(position[0], position[1], position[2]))
                .times(Mat4.scale(this.width/2, this.width/2, this.width/2));
            this.shape.draw(context, program_state, transform, this.material);
        }
    }

const Ghost = items.Ghost =
    class Ghost {
        constructor(parameters) {
            this.type = OBJECT_TYPE.GHOST;
            this.speed = GHOST_SPEED;
            this.radius = GHOST_RADIUS;
            this.ambient = 1;
            this.color = hex_color("#FF0000");
            this.shape = new defs.Subdivision_Sphere(4),
            Object.assign(this, parameters);
            this.material = new Material(new defs.Phong_Shader(),
                {ambient: this.ambient, color: this.color });
        }

        draw(context, program_state, position) {
            let transform = Mat4.identity();
            transform = transform
                .times(Mat4.translation(position[0], position[1], position[2]))
                .times(Mat4.scale(this.radius, this.radius, this.radius));
            this.shape.draw(context, program_state, transform, this.material);
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
    '            .       #             #       .            ',
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
        constructor(objectPositionList, positionObjectMap) {
            this.map = DEFAULT_MAP_LIST;
            this.bottom = -(this.map.length - 1);
            this.top = 0;
            this.left = 0;
            this.right = Math.floor(this.map[0].length / 2);
            this.centerX = (this.left + this.right) / 2;
            this.centerY = (this.bottom + this.top) / 2;
            this.pacmanBirthplace = null;
            this.ghostBirthplace = null;
            for(let row = 0; row < this.map.length; row++) {
                let y = -row;
                positionObjectMap[y] = {};
                for (let column = 0; column < this.map[row].length; column += 2) {
                    let x = Math.floor(column / 2);
                    let positionVec = vec3(x, y, 0);
                    let cell = this.map[row][column];
                    if (cell === "#") {
                        positionObjectMap[y][x] = OBJECT_TYPE.WALL;
                        objectPositionList.push({type: OBJECT_TYPE.WALL, position: positionVec});
                    } else if (cell === "P") {
                        this.pacmanBirthplace = positionVec;
                    } else if (cell === "G") {
                        this.ghostBirthplace = positionVec;
                    }
                }
            }
        }
        getAt(position) {
            let x = Math.round(position[0]), y = Math.round(position[1]);
            return this.map[y] && this.map[y][x];
        }

        isWall(position) {
            let cell = this.getAt(position);
            return cell && cell.type === OBJECT_TYPE.WALL;
        }
    }

