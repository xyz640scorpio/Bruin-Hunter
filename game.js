import { defs, tiny, items } from './examples/items.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Game extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        this.objects = {
            wall: new items.Wall(),
            pacman: new items.Ghost(),
            ghost: new items.Ghost(),
        }
        this.objectPositionList = [];
        this.positionObjectMap = {};
        this.map = new items.Map(this.objectPositionList, this.positionObjectMap);
        this.pacmanPosition = this.map.pacmanBirthplace;
        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("View solar system", ["Control", "0"], () => this.attached = () => this.initial_camera_location);
        this.new_line();
        this.key_triggered_button("Attach to planet 1", ["Control", "1"], () => this.attached = () => null);
        this.key_triggered_button("Attach to planet 2", ["Control", "2"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("Attach to planet 3", ["Control", "3"], () => this.attached = () => null);
        this.key_triggered_button("Attach to planet 4", ["Control", "4"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("Attach to moon", ["Control", "m"], () => this.attached = () => null);
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
        program_state.lights = [new Light(vec4(0, 0, 0, 1), hex_color("#FFFFFF"), 10 ** 3)];
        this.objectPositionList.forEach(function(item) {
            if (item.type === items.exports.OBJECT_TYPE.WALL) {
                this.objects.wall.draw(context, program_state, item.position);
            }
        }, this);
        this.objects.pacman.draw(context, program_state, this.pacmanPosition);
    }
}
