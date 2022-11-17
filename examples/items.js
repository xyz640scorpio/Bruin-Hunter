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
}

const DIRECTION = {
    UP:     vec4(0, 1, 0, 0),
    DOWN:   vec4(0, -1, 0, 0),
    LEFT:   vec4(-1, 0, 0, 0),
    RIGHT:  vec4(1, 0, 0, 0),
}

const spin_axis = vec3(0, 0, 1);
const PACMAN_SPEED = 2;
const PACMAN_RADIUS = 0.25;
const DOT_RADIUS = 0.05;
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
        }

        advance(time_amount) {}

        blend_state() {
            // blend_state(): Compute the final matrix we'll draw using the previous two physical
            // locations the object occupied.  We'll interpolate between these two states as
            // described at the end of the "Fix Your Timestep!" blog post.
            this.drawn_location = Mat4.translation(...this.draw_centor)
                .times(this.rotation)
                .times(Mat4.scale(...this.size));
        }

        draw(context, program_state) {
            this.shape.draw(context, program_state, this.drawn_location, this.material);
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
                rgb: new Texture("./assets/rgb.jpg"),
                earth: new Texture("./assets/earth.gif"),
                stars: new Texture("./assets/stars.png"),
                text: new Texture("./assets/text.png"),
            };
            this.shapes = {
                donut: new defs.Torus(15, 15, [[0, 2], [0, 1]]),
                cone: new defs.Closed_Cone(4, 10, [[0, 2], [0, 1]]),
                capped: new defs.Capped_Cylinder(4, 12, [[0, 2], [0, 1]]),
                ball: new defs.Subdivision_Sphere(4, [[0, 1], [0, 1]]),
                cube: new defs.Cube(),
                prism: new (defs.Capped_Cylinder.prototype.make_flat_shaded_version())(10, 10, [[0, 2], [0, 1]]),
                gem: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
                donut2: new (defs.Torus.prototype.make_flat_shaded_version())(20, 20, [[0, 2], [0, 1]]),
            };
            this.audios = {
                // start: new Audio('./audio/pacman_beginning.mp3'),
                // chomp: new Audio('./audio/pacman_chomp.mp3'),
                // death: new Audio('./audio/pacman_death.mp3'),
                // eat:   new Audio('./audio/pacman_eatghost.mp3'),
                day:   new Audio('./audio/day_mode.mp3'),
                twilight: new Audio('./audio/twilight_mode.mp3'),
                nightmare: new Audio('./audio/nightmare_mode.mp3')
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
items.exports = {OBJECT_TYPE, PACMAN_SPEED, PACMAN_RADIUS}

const WALL_SIZE = vec3(0.5, 0.5, 0.5);
const WALL_MATERIAL = new Material(
    data_loader.shaders.fake_bump_map,
    {   ambient: 0.5,
        color: hex_color("#0000FF"),
        texture: data_loader.textures.stars
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

        static isIntersect(p, margin = 0) {
            let width = WALL_SIZE[0];
            p.apply(value =>  width+margin-Math.abs(value));
            return p.maximize();
        }
    }

const HUNTER_SPEED = 1.5;
const HUNTER_RADIUS = 0.25 * 1.25;
const HUNTER_SIZE = vec3(HUNTER_RADIUS, HUNTER_RADIUS, HUNTER_RADIUS);
const HUNTER_MATERIAL = new Material(
    data_loader.shaders.fake_bump_map,
    {   ambient: 0.5,
        color: hex_color("#FF0000"),
        texture: data_loader.textures.rgb
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
    {   ambient: 0.5,
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

        blend_state() {
            this.draw_centor = this.centor;
            this.drawn_location = Mat4.translation(...this.draw_centor)
                .times(this.rotation)
                .times(Mat4.scale(...this.size))
                .times(Mat4.rotation(-Math.PI/2, 0, 1, 0));
        }

        advance(dt) {
            this.centor.add_by(this.rotation.times(DIRECTION.UP).to3().times(dt * this.speed));
        }

        rotate(dt) {
            this.rotation = this.rotation.times(Mat4.rotation(dt * Math.PI / 2, ...spin_axis));
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
        constructor(objectList) {
            this.MAP = DEFAULT_MAP_LIST;
            this.MAP = DEBUG_MAP_LIST;
            this.bottom = -(this.MAP.length - 1);
            this.top = 0;
            this.left = 0;
            this.right = Math.floor(this.MAP[0].length / 2);
            this.bruinBirthplace = null; this.hunterBirthplace = null;
            this.positionObjectMap = {};
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
    }


const MusicPlayer = items.MusicPlayer =
    class MusicPlayer {
        constructor() {
            Object.assign(this,
                {audios: data_loader.audios})
            this.audios.day.loop = true;
            this.audios.day.preload = 'auto';
            this.audios.twilight.loop = true;
            this.audios.twilight.preload = 'auto';
            this.audios.nightmare.loop = true;
            this.audios.nightmare.preload = 'auto';
        }

        play_background_sound(mode = 1) {
            if (mode === 0) {
                this.audios.day.play();
            } else if (mode === 1) {
                this.audios.twilight.play();
            } else if (mode === 2) {
                this.audios.nightmare.play();
            }
        }

        pause_background_sound(mode = 1) {
            if (mode === 0) {
                this.audios.day.pause();
            } else if (mode === 1) {
                this.audios.twilight.pause();
            } else if (mode === 2) {
                this.audios.nightmare.pause();
            }
        }
    }


