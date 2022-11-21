import { defs, tiny } from './common.js';

const {
    Vector, Vector3, vec, vec3, vec4, hex_color, Matrix, Mat4,
    Light, Shape, Material, Shader, Texture, Scene
} = tiny;


const items = {};

export {tiny, defs, items};

const OBJECT_TYPE = {
    WALL: 1,
    BRUIN: 2,
    HUNTER: 3,
    DOT: 4,
}

const DIRECTION = {
    UP:     vec4(0, 1, 0, 0),
    DOWN:   vec4(0, -1, 0, 0),
    LEFT:   vec4(-1, 0, 0, 0),
    RIGHT:  vec4(1, 0, 0, 0),
}

const spin_axis = vec3(0, 0, 1);
const DEFAULT_CENTER = vec3(0, 0, 0);
const DEFAULT_ROTATION = Mat4.identity();
const Body = items.Body =
    class Body {
        // **Body** can store and update the properties of a 3D body that incrementally
        // moves from its previous place due to velocities.  It conforms to the
        // approach outlined in the "Fix Your Timestep!" blog post by Glenn Fiedler.
        constructor(shape, material, size) {
            Object.assign(this, {shape, material, size});
            this.centor = DEFAULT_CENTER;
            this.draw_centor = this.centor; // by default, we don't use mix(previous_state, alpha)
            this.rotation = DEFAULT_ROTATION;
            this.drawn_location = undefined;
            this.visible = true;
            this.speed = 0;
        }

        advance(dt) {
            this.centor.add_by(this.rotation.times(DIRECTION.UP).to3().times(dt * this.speed));
        }

        rotate(dt) {
            this.rotation = this.rotation.times(Mat4.rotation(dt * Math.PI / 2, ...spin_axis));
        }

        blend_state() {
            // blend_state(): Compute the final matrix we'll draw using the previous two physical
            // locations the object occupied.  We'll interpolate between these two states as
            // described at the end of the "Fix Your Timestep!" blog post.
            this.drawn_location = Mat4.translation(...this.draw_centor)
                .times(this.rotation)
                .times(Mat4.scale(...this.size));
        }

        draw(context, program_state) {
            if (this.visible) {
                this.shape.draw(context, program_state, this.drawn_location, this.material);
            }
        }

        cal_inverse() {
            this.inverse = Mat4.inverse(this.drawn_location);
        }

        static get_direction_vec(rotation) {
            return rotation.times(DIRECTION.UP).to3();
        }
    }

const Data_Loader = items.Data_Loader =
    class Data_Loader {
    // **Test_Data** pre-loads some Shapes and Textures that other Scenes can borrow.
        constructor() {
            this.textures = {
                bruin: new Texture("./assets/bruin_2.png"),
                hunter: new Texture("./assets/usc_hunter.png"),
                game_over: new Texture("./assets/gameOver.png"),
                you_win: new Texture("./assets/winText.png"),
                stars: new Texture("./assets/stars.png"),
                usc: new Texture("./assets/USCLogo.png")
            };
            this.shapes = {
                ball: new defs.Subdivision_Sphere(4, [[0, 1], [0, 1]]),
                cube: new defs.Cube(),
                square: new defs.Square(),
            };
            this.audios = {
                day:   new Audio('./audio/day_mode.mp3'),
                background: new Audio('./audio/twilight_mode.mp3'),
                nightmare: new Audio('./audio/nightmare_mode.mp3'),
                death: new Audio('./audio/death.mp3')
            };
            this.shaders = {
                textured_phong: new defs.Textured_Phong(1),
                phong_shader: new defs.Phong_Shader(),
                fake_bump_map: new defs.Fake_Bump_Map(1),
            };
        }

        random_shape(shape_list = this.shapes) {
            const shape_names = Object.keys(shape_list);
            return shape_list[shape_names[~~(shape_names.length * Math.random())]]
        }
    }

const data_loader = new Data_Loader();

const WALL_SIZE = vec3(0.5, 0.5, 0.5);
const WALL_MATERIAL = new Material(
    data_loader.shaders.fake_bump_map,
    {   ambient: 1,
        color: hex_color("#0000FF"),
        texture: data_loader.textures.usc
    });
const Wall = items.Wall =
    class Wall extends Body {
        constructor(position, parameters=undefined) {
            super(data_loader.shapes.cube, WALL_MATERIAL, WALL_SIZE);
            this.type = OBJECT_TYPE.WALL;
            Object.assign(this.material, parameters);
            this.centor = position;
            this.draw_centor = position; // we won't update centor for Wall
            this.blend_state();
            this.cal_inverse();
        }

        static isWall(item) {
            return item && item.type && item.type === OBJECT_TYPE.WALL;
        }
    }

const DOT_RADIUS = 0.05;
const DOT_SIZE = vec3(DOT_RADIUS, DOT_RADIUS, DOT_RADIUS);
const DOT_MATERIAL = new Material(
    data_loader.shaders.phong_shader,
    {   ambient: 1,
        color: hex_color("#E5D080")
    });
const Dot = items.Dot =
    class extends Body {
        constructor(position, parameters=undefined) {
            super(data_loader.shapes.ball, DOT_MATERIAL, DOT_SIZE);
            this.type = OBJECT_TYPE.DOT;
            this.radius = DOT_RADIUS;
            Object.assign(this.material, parameters);
            this.centor = position;
            this.draw_centor = position; // we won't update centor for Wall
            this.blend_state();
            this.cal_inverse();
        }

        static isDot(item) {
            return item && item.type && item.type === OBJECT_TYPE.DOT;
        }
    }

const HUNTER_SPEED = 1;
const HUNTER_RADIUS = 0.25 * 1.25;
const HUNTER_SIZE = vec3(HUNTER_RADIUS, HUNTER_RADIUS, HUNTER_RADIUS);
const HUNTER_MATERIAL = new Material(
    data_loader.shaders.fake_bump_map,
    {   ambient: 0.5,
        color: hex_color("#FF0000"),
        texture: data_loader.textures.hunter
    });
const Hunter = items.Hunter =
    class Hunter extends Body {
        constructor(position, direction, parameters) {
            super(data_loader.shapes.ball, HUNTER_MATERIAL, HUNTER_SIZE);
            this.type = OBJECT_TYPE.HUNTER;
            this.speed = HUNTER_SPEED;
            Object.assign(this.material, parameters);

            this.centor = position.copy();
            this.rotation = Mat4.rotation(direction, ...spin_axis);
            this.blend_state();
        }

        blend_state() {
            this.draw_centor = this.centor;
            super.blend_state();
            this.drawn_location = this.drawn_location
                .times(Mat4.rotation(-Math.PI/2, 0, 1, 0))
                .times(Mat4.rotation(-Math.PI, 1, 0, 0));
        }

        advance(dt) {
            this.centor.add_by(this.rotation.times(DIRECTION.UP).to3().times(dt * this.speed));
        }

        virtual_advance(ds) {
            return this.centor.plus(this.rotation.times(DIRECTION.UP).to3().times(ds));
        }

        virtual_rotate(angle) {
            return this.rotation.times(Mat4.rotation(angle, ...spin_axis));
        }
    }

const BRUIN_SPEED = 2;
const BRUIN_RADIUS = 0.25;
const BRUIN_SIZE = vec3(BRUIN_RADIUS, BRUIN_RADIUS, BRUIN_RADIUS);
const BRUIN_MATERIAL = new Material(
    data_loader.shaders.fake_bump_map,
    {   ambient: 1,
        color: hex_color("#FF0000"),
        texture: data_loader.textures.bruin
    });
const Bruin = items.Bruin =
    class Bruin extends Body {
        constructor(position, direction, parameters) {
            super(data_loader.shapes.ball, BRUIN_MATERIAL, BRUIN_SIZE);
            this.type = OBJECT_TYPE.BRUIN;
            this.speed = BRUIN_SPEED;
            this.radius = BRUIN_RADIUS;
            Object.assign(this.material, parameters);

            this.centor = position.copy();
            this.rotation = Mat4.rotation(direction, ...spin_axis);
            this.blend_state();
        }

        transparent(delta) {
            this.material.ambient = Math.max(this.material.ambient - 0.3 * delta, 0.2);
        }

        blend_state() {
            this.draw_centor = this.centor;
            this.drawn_location = Mat4.translation(...this.draw_centor)
                .times(this.rotation)
                .times(Mat4.scale(...this.size))
                .times(Mat4.rotation(-Math.PI/2, 0, 1, 0));
        }

        collision_wall(wall) {
            let dp = vec3(0, 0, 0);
            let x = wall.centor[0], y = wall.centor[1];
            let width = this.radius + wall.size[0];
            let dx = this.centor[0] - x;
            let dy = this.centor[1] - y;
            if (Math.abs(dx) >= width || Math.abs(dy) >= width) {
                return dp;
            }
            if (Math.abs(dx) >= Math.abs(dy)) {
                dp[0] = dx < 0 ? - width - dx : width - dx;
            } else {
                dp[1] = dy < 0 ? - width - dy : width - dy;
            }
            return dp;
        }

        static if_collision(p, margin=0) {
            return p.dot(p) < 1 + margin;
        }

        collision_item(item) {
            let points = item.shape.arrays.position;
            const T = this.inverse.times(item.drawn_location);
            return points.some(p => Bruin.if_collision(T.times(p.to4(1)).to3()))
        }
    }

const TEXT_SIZE = vec3(2, 2, 0.1);
const TEXT_MATERIAL = new Material(
    data_loader.shaders.fake_bump_map,
    {   ambient: 1,
        color: hex_color("#FF0000"),
        texture: data_loader.textures.game_over
    });
const Text = items.Text =
    class Text extends Body {
        constructor(parameters) {
            super(data_loader.shapes.square, TEXT_MATERIAL, TEXT_SIZE);
            Object.assign(this.material, parameters);
            this.visible = false;
        }

        readyShow(bruin, win=false) {
            if (win) {
                Object.assign(this.material, {
                    color: hex_color("#3284BF"),
                    texture: data_loader.textures.you_win
                });
            }
            let direction = Body.get_direction_vec(bruin.rotation);
            this.centor = bruin.centor.plus(direction, 0.6);
            this.centor[2] = 0.6;
            this.rotation = bruin.rotation;
            this.draw_centor = this.centor;
            this.blend_state();
            this.visible = true;
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
        constructor(objectList) {
            this.MAP = DEFAULT_MAP_LIST;
            // this.MAP = DEBUG_MAP_LIST;
            this.bottom = -(this.MAP.length - 1);
            this.top = 0;
            this.left = 0;
            this.right = Math.floor(this.MAP[0].length / 2);
            this.centorX = (this.left + this.right) / 2;
            this.centorY = (this.bottom + this.top) / 2;
            this.bruinBirthplace = null; this.hunterBirthplace = null;
            this.positionObjectMap = {};
            this.num_dots = 0;
            for(let row = 0; row < this.MAP.length; row++) {
                let y = -row;
                this.positionObjectMap[y] = {};
                for (let column = 0; column < this.MAP[row].length; column += 2) {
                    let x = Math.floor(column / 2);
                    let positionVec = vec3(x, y, 0);
                    let cell = this.MAP[row][column];
                    if (cell === "#") {
                        let wall = new Wall(positionVec);
                        this.positionObjectMap[y][x] = wall;
                        objectList.push(wall);
                    } else if (cell === "P") {
                        this.bruinBirthplace = positionVec;
                    } else if (cell === "G") {
                        this.hunterBirthplace = positionVec;
                    } else if (cell === ".") {
                        let dot = new Dot(positionVec);
                        this.positionObjectMap[y][x] = dot;
                        objectList.push(dot);
                        this.num_dots += 1;
                    }
                }
            }
        }

        isWall(x, y) {
            let item = undefined;
            if (this.positionObjectMap[y] && this.positionObjectMap[y][x]) {
                item = this.positionObjectMap[y][x];
            }
            return Wall.isWall(item);
        }

        isDot(x, y) {
            let item = undefined;
            if (this.positionObjectMap[y] && this.positionObjectMap[y][x]) {
                item = this.positionObjectMap[y][x];
            }
            if (item) {
                return item.visible && (Dot.isDot(item));
            }
            return false;
        }
    }


const MusicPlayer = items.MusicPlayer =
    class MusicPlayer {
        constructor() {
            Object.assign(this,
                {audios: data_loader.audios})
            this.audios.background.loop = true;
            this.audios.background.preload = 'auto';
            this.audios.death.loop = true;
            this.audios.death.preload = 'auto';
            this.win_lost = -1
        }

        play_background_sound(mode = 1) {
            if (this.win_lost === -1) {
                this.audios.background.muted = true;
                this.audios.death.muted = false;
                this.audios.death.play();
            } else {
                this.audios.background.muted = false;
                this.audios.death.muted = true;
                this.audios.background.play();
            }
        }

        pause_background_sound(mode = 1) {
            this.audios.background.muted = true;
            this.audios.death.muted = true;
        }

        continue_background_sound(mode = 1) {
            this.audios.background.muted = false;
            this.audios.death.muted = false;
        }
    }


