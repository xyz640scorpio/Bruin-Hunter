import { defs, tiny, items } from './examples/items.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Game extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        this.music_player = new items.MusicPlayer();

        this.objectList = [];
        this.map = new items.Map(this.objectList);
        this.bruin = new items.Bruin(this.map.bruinBirthplace, Math.PI/2);
        this.text = new items.Text();
        this.hunter_list = [];
        this.numHunter = 4;
        for(let i = 0; i < this.numHunter; i++) {
            this.hunter_list.push(new items.Hunter(this.map.hunterBirthplace, -Math.PI/2));
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.keys = {};
        this.win_lost = 0; // 1 mean win, -1 mean lost
        this.previousFrameTime = window.performance.now();
        this.mouse_enabled_canvases = new Set();

        this.TOP = vec3(0, 0, 1);
        let direction = items.Body.get_direction_vec(this.bruin.rotation);
        this.cameraPosition = this.bruin.centor.plus(this.TOP, 3).plus(direction, -1);
        this.cameraLookAt = this.bruin.centor.plus(direction);
    }

    add_mouse_controls(canvas) {
        // add_mouse_controls():  Attach HTML mouse events to the drawing canvas.
        // First, measure mouse steering, for rotating the flyaround camera:
        this.mouse = {"from_center": vec(0, 0)};
        const mouse_position = (e, rect = canvas.getBoundingClientRect()) =>
            vec(e.clientX - (rect.left + rect.right) / 2, e.clientY - (rect.bottom + rect.top) / 2);
        // Set up mouse response.  The last one stops us from reacting if the mouse leaves the canvas:
        document.addEventListener("mouseup", e => {
            this.mouse.anchor = undefined;
        });
        canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            this.mouse.anchor = mouse_position(e);
        });
        canvas.addEventListener("mousemove", e => {
            e.preventDefault();
            this.mouse.from_center = mouse_position(e);
        });
        canvas.addEventListener("mouseout", e => {
            if (!this.mouse.anchor) this.mouse.from_center.scale_by(0)
        });
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Forward", ["w"], () => this.keys['w'] = true, undefined, () => this.keys['w'] = false);
        this.key_triggered_button("Back", ["s"], () => this.keys['s'] = true, undefined, () => this.keys['s'] = false);
        this.key_triggered_button("Left", ["a"], () => this.keys['a'] = true, undefined, () => this.keys['a'] = false);
        this.key_triggered_button("Right", ["d"], () => this.keys['d'] = true, undefined, () => this.keys['d'] = false);
    }

    updateBruin(delta) {
        if (this.win_lost === -1) {
            this.bruin.transparent(delta);
            return;
        } else if (this.win_lost === 1) {
            return;
        }
        if (this.keys['w']) {
            this.bruin.advance(delta);
        } else if (this.keys['s']) {
            this.bruin.advance(-delta);
        }
        if (this.keys['a']) {
            this.bruin.rotate(delta);
        } else if (this.keys['d']) {
            this.bruin.rotate(-delta);
        }
        let dx_list = [1, 0, -1], dy_list = [1, 0, -1];
        let visited = {}
        this.bruin.cal_inverse();
        let dp = vec3(0, 0, 0);
        for(let i = 0; i < dx_list.length; i++) {
            let x = Math.round(this.bruin.centor[0]) + dx_list[i];
            for(let j = 0; j < dy_list.length; j++) {
                let y = Math.round(this.bruin.centor[1]) + dy_list[j];
                if (visited[1000*x + y]) {
                    continue;
                }
                visited[1000*x+y] = true;
                if (this.map.isWall(x, y)) {
                    let wall = this.map.positionObjectMap[y][x];
                    let this_dp = this.bruin.collision_wall(wall);
                    if (dp.norm() < this_dp.norm()) {
                        dp = this_dp;
                    }
                } else if (this.map.isDot(x, y)) {
                    let item = this.map.positionObjectMap[y][x];
                    let is_collision = this.bruin.collision_item(item);
                    if (is_collision) {
                        item.visible = false;
                        this.map.num_dots -= 1;
                    }
                }
            }
        }
        this.bruin.centor.add_by(dp);
        this.bruin.blend_state();
    }

    updateHunter(delta, hunter) {
        if (this.win_lost === 1) {
            return;
        }
        let previousPosition = hunter.virtual_advance(0.5).round();
        let currentPosition = hunter.virtual_advance(0.5 + delta * hunter.speed).round();
        if (currentPosition.equals(previousPosition)) {
            hunter.advance(delta);
            hunter.blend_state();
            return;
        }
        let leftTurn = hunter.virtual_rotate(Math.PI/2);
        let rightTurn = hunter.virtual_rotate(-Math.PI/2);
        let backwardTurn = hunter.virtual_rotate(Math.PI);

        let forwardWall = this.map.isWall(currentPosition[0], currentPosition[1]);
        let virtual_left_pos = hunter.centor.plus(items.Body.get_direction_vec(leftTurn)).round();
        let leftWall = this.map.isWall(virtual_left_pos[0], virtual_left_pos[1]);
        let virtual_right_pos = hunter.centor.plus(items.Body.get_direction_vec(rightTurn)).round();
        let rightWall = this.map.isWall(virtual_right_pos[0], virtual_right_pos[1]);
        let virtual_backward_pos = hunter.centor.plus(items.Body.get_direction_vec(backwardTurn)).round();
        let backwardWall = this.map.isWall(virtual_backward_pos[0], virtual_backward_pos[1]);

        let possibleTurns = [];
        if (!forwardWall) possibleTurns.push(hunter.rotation);
        if (!leftWall) possibleTurns.push(leftTurn);
        if (!rightWall) possibleTurns.push(rightTurn);
        if (possibleTurns.length == 0 && !backwardWall) possibleTurns.push(backwardTurn);
        if (possibleTurns.length === 0) {
            throw new Error('A hunter got stuck!');
        }

        let newDirection = possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
        hunter.rotation = newDirection;
        hunter.centor.round();

        hunter.advance(delta);
        hunter.blend_state();
    }

    update(context) {
        let now = window.performance.now();
        let animationDelta = Math.min((now - this.previousFrameTime) / 1000, 1/30);
        this.previousFrameTime = now;

        this.updateBruin(animationDelta);
        for(let i = 0; i < this.numHunter; i++) {
            let hunter = this.hunter_list[i];
            this.updateHunter(animationDelta, hunter);
            let is_collision = this.bruin.collision_item(hunter);
            if (is_collision) {
                this.win_lost = -1;
                this.music_player.pause_background_sound();
                this.text.readyShow(this.bruin, false);
            }
        }
        if (this.win_lost === 0 && this.map.num_dots == 0) {
            this.text.readyShow(this.bruin, true);
            this.win_lost = 1
        }
        this.updateCamera(context, animationDelta);
    }

    updateCamera(context, delta) {
        let direction = items.Body.get_direction_vec(this.bruin.rotation);
        if (this.win_lost === 1) {
            this.cameraPosition.set(this.map.centorX, this.map.centorY, 50);
            this.cameraLookAt.set(this.map.centorX, this.map.centorY, 0);
            return;
        } else if (this.win_lost === -1) {
            this.cameraPosition = this.bruin.centor.plus(this.TOP, 4);
            this.cameraLookAt = this.bruin.centor.plus(direction, 0.1);
            return;
        }
        this.cameraPosition = this.bruin.centor.plus(this.TOP, 3).plus(direction, -1);
        this.cameraLookAt = this.bruin.centor.plus(direction);
        if (!this.mouse_enabled_canvases.has(context.canvas)) {
            this.add_mouse_controls(context.canvas);
            this.mouse_enabled_canvases.add(context.canvas)
        }
        if (this.mouse.anchor) {
            const dragging_vector = this.mouse.from_center.minus(this.mouse.anchor);
            let delta = 0.01;
            if (dragging_vector.norm() > 0) {
                let mouse_vec = vec3(dragging_vector[0], -dragging_vector[1], Math.abs(dragging_vector[0]) + Math.abs(dragging_vector[1])/2);
                mouse_vec = this.bruin.rotation.times(mouse_vec.to4(0)).to3();
                if (mouse_vec.norm() > 100) {
                    mouse_vec = mouse_vec.normalized();
                    mouse_vec.scale_by(250);
                }
                this.cameraPosition.add_by(mouse_vec, delta);
                this.cameraLookAt.add_by(mouse_vec, delta);
            }
        }
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }
        this.update(context);

        this.music_player.play_background_sound();
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
        program_state.lights = [new Light(vec4(0, 0, 50, 1), hex_color("#FFFFFF"), 10 ** 2)];
        this.objectList.forEach((item) => {item.draw(context, program_state);});
        for(let i = 0; i < this.numHunter; ++i) {
            this.hunter_list[i].draw(context, program_state);
        }
        this.bruin.draw(context, program_state);
        if (this.text.visible) {
            this.text.draw(context, program_state);
        }

        let desired = Mat4.look_at(this.cameraPosition, this.cameraLookAt, this.TOP);
        desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
        program_state.set_camera(desired);
    }
}
