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
            pacman: new items.Ghost({
                radius: items.exports.PACMAN_RADIUS,
                speed: items.exports.PACMAN_SPEED,
                color: hex_color("#FFFF00")}),
            ghost: new items.Ghost(),
        }
        this.UP = vec4(0, 1, 0, 0); this.DOWN = vec4(0, -1, 0, 0);
        this.LEFT = vec4(-1, 0, 0, 0); this.RIGHT = vec4(1, 0, 0, 0);

        this.objectPositionList = [];
        this.map = new items.Map(this.objectPositionList);

        this.pacmanPosition = this.map.pacmanBirthplace;
        this.pacmanDirection = Mat4.rotation(Math.PI / 2, 0, 0, 1);
        this.ghostPositionList = [];
        this.ghostDirectionList = [];
        this.numGhost = 4;
        for(let i = 0; i < this.numGhost; i++) {
            this.ghostPositionList.push(this.map.ghostBirthplace.copy());
            this.ghostDirectionList.push(Mat4.rotation(-Math.PI / 2, 0, 0, 1));
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.keys = {};
        this.win_lost = 0; // 1 mean win, -1 mean lost
        this.previousFrameTime = window.performance.now();
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Forward", ["w"], () => this.keys['w'] = true, undefined, () => this.keys['w'] = false);
        this.key_triggered_button("Back", ["s"], () => this.keys['s'] = true, undefined, () => this.keys['s'] = false);
        this.key_triggered_button("Left", ["a"], () => this.keys['a'] = true, undefined, () => this.keys['a'] = false);
        this.key_triggered_button("Right", ["d"], () => this.keys['d'] = true, undefined, () => this.keys['d'] = false);

        // this.key_triggered_button("Up", [" "], () => this.thrust[1] = -1, undefined, () => this.thrust[1] = 0);
        // this.key_triggered_button("Forward", ["w"], () => this.thrust[2] = 1, undefined, () => this.thrust[2] = 0);
        // this.new_line();
        // this.key_triggered_button("Left", ["a"], () => this.thrust[0] = 1, undefined, () => this.thrust[0] = 0);
        // this.key_triggered_button("Back", ["s"], () => this.thrust[2] = -1, undefined, () => this.thrust[2] = 0);
        // this.key_triggered_button("Right", ["d"], () => this.thrust[0] = -1, undefined, () => this.thrust[0] = 0);
        // this.new_line();
        // this.key_triggered_button("Down", ["z"], () => this.thrust[1] = 1, undefined, () => this.thrust[1] = 0);
    }

    updatePacman(delta) {
        if (this.win_lost !== 0) {
            return;
        }
        if (this.keys['w']) {
            this.pacmanPosition.add_by(this.pacmanDirection.times(this.UP).to3().times(delta * this.objects.pacman.speed));
        } else if (this.keys['s']) {
            this.pacmanPosition.add_by(this.pacmanDirection.times(this.UP).to3().times(-delta * this.objects.pacman.speed));
        } else if (this.keys['a']) {
            this.pacmanDirection = this.pacmanDirection.times(Mat4.rotation(Math.PI / 2 * delta, 0, 0, 1));
        } else if (this.keys['d']) {
            this.pacmanDirection = this.pacmanDirection.times(Mat4.rotation(-Math.PI / 2 * delta, 0, 0, 1));
        }
        let pacman_radius = items.exports.PACMAN_RADIUS;

        let leftSide = this.pacmanPosition.plus(this.LEFT.to3().times(pacman_radius)); items.round_vec3(leftSide);
        let topSide = this.pacmanPosition.plus(this.UP.to3().times(pacman_radius)); items.round_vec3(topSide);
        let rightSide = this.pacmanPosition.plus(this.RIGHT.to3().times(pacman_radius)); items.round_vec3(rightSide);
        let bottomSide = this.pacmanPosition.plus(this.DOWN.to3().times(pacman_radius)); items.round_vec3(bottomSide);
        if (this.map.isWall(leftSide)) {
            this.pacmanPosition[0] = leftSide[0] + 0.5 + pacman_radius;
        } else if (this.map.isWall(rightSide)) {
            this.pacmanPosition[0] = rightSide[0] - 0.5 - pacman_radius;
        }
        if (this.map.isWall(topSide)) {
            this.pacmanPosition[1] = topSide[1] - 0.5 - pacman_radius;
        } else if (this.map.isWall(bottomSide)) {
            this.pacmanPosition[1] = bottomSide[1] + 0.5 + pacman_radius;
        }

        let width = items.exports.WALL_WIDTH/2;
        let dx_list = [0.5, 0, -0.5], dy_list = [0.5, 0, -0.5];
        let visited = {}
        for(let i = 0; i < dx_list.length; i++) {
            let x = Math.round(this.pacmanPosition[0] + dx_list[i]);
            for(let j = 0; j < dy_list.length; j++) {
                let y = Math.round(this.pacmanPosition[1] + dy_list[j]);
                if (visited[100*x + y]) {
                    continue;
                }
                visited[100*x+y] = true;
                // if (!this.map.isWall(undefined, x, y)) {
                //     continue;
                // }
                let cell = undefined;
                if (this.map.positionObjectMap[y] && this.map.positionObjectMap[y][x]) {
                    cell = this.map.positionObjectMap[y][x];
                }
                if (!cell || cell.type !== items.exports.OBJECT_TYPE.WALL) {
                    continue;
                }
                let x_distance = Math.abs(x - this.pacmanPosition[0]);
                let y_distance = Math.abs(y - this.pacmanPosition[1]);
                if (Math.max(x_distance, y_distance) >= width + pacman_radius) {
                    continue;
                }
                let corner_distance = Math.sqrt((x_distance - width)*(x_distance - width) + (y_distance - width)*(y_distance - width));
                if (corner_distance >= pacman_radius) {
                    continue;
                }
                if (this.keys['w']) {
                    this.pacmanPosition.subtract_by(this.pacmanDirection.times(this.UP).to3().times(pacman_radius - corner_distance));
                } else if (this.keys['s']) {
                    this.pacmanPosition.add_by(this.pacmanDirection.times(this.UP).to3().times(pacman_radius - corner_distance));
                }
            }
        }
    }

    updateGhost(delta, i) {
        if (i < 0 || i >= this.numGhost) {
            return;
        }
        let previousPosition = this.ghostPositionList[i].plus(this.ghostDirectionList[i].times(this.UP).to3().times(0.5));
        items.round_vec3(previousPosition);
        let currentPosition = this.ghostPositionList[i].plus(this.ghostDirectionList[i].times(this.UP).to3().times(0.5 + delta * this.objects.ghost.speed));
        items.round_vec3(currentPosition);
        if (currentPosition.equals(previousPosition)) {
            this.ghostPositionList[i].add_by(this.ghostDirectionList[i].times(this.UP).to3().times(delta * this.objects.ghost.speed));
            return;
        }
        let leftTurn = this.ghostDirectionList[i].times(Mat4.rotation(Math.PI/2, 0, 0, 1));
        let rightTurn = this.ghostDirectionList[i].times(Mat4.rotation(-Math.PI/2, 0, 0, 1));
        let backwardTurn = this.ghostDirectionList[i].times(Mat4.rotation(Math.PI, 0, 0, 1));

        let forwardWall = this.map.isWall(currentPosition);
        let leftWall = this.map.isWall(this.ghostPositionList[i].plus(leftTurn.times(this.UP).to3()));
        let rightWall = this.map.isWall(this.ghostPositionList[i].plus(rightTurn.times(this.UP).to3()));
        let backwardWall = this.map.isWall(this.ghostPositionList[i].plus(backwardTurn.times(this.UP).to3()));

        let possibleTurns = [];
        if (!forwardWall) possibleTurns.push(this.ghostDirectionList[i]);
        if (!leftWall) possibleTurns.push(leftTurn);
        if (!rightWall) possibleTurns.push(rightTurn);
        if (possibleTurns.length == 0 && !backwardWall) possibleTurns.push(backwardTurn);
        if (possibleTurns.length === 0) {
            throw new Error('A ghost got stuck!');
        }

        let newDirection = possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
        this.ghostDirectionList[i] = newDirection;
        items.round_vec3(this.ghostPositionList[i]);
        this.ghostPositionList[i].add_by(this.ghostDirectionList[i].times(this.UP).to3().times(delta * this.objects.ghost.speed));
    }

    update() {
        let now = window.performance.now();
        let animationDelta = Math.min((now - this.previousFrameTime) / 1000, 1/30);
        this.previousFrameTime = now;

        this.updatePacman(animationDelta);
        for(let i = 0; i < this.numGhost; i++) {
            this.updateGhost(animationDelta, i);
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
        this.update();

        // [TODO](zyksir) play sound
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
        program_state.lights = [new Light(vec4(0, 0, 50, 1), hex_color("#FFFFFF"), 10 ** 2)];
        this.objectPositionList.forEach(function(item) {
            if (item.type === items.exports.OBJECT_TYPE.WALL) {
                this.objects.wall.draw(context, program_state, item.position);
            }
        }, this);
        for(let i = 0; i < this.numGhost; ++i) {
            this.objects.ghost.draw(context, program_state, this.ghostPositionList[i], this.ghostDirectionList[i]);
        }
        let pacman_transform = this.objects.pacman.draw(context, program_state, this.pacmanPosition, this.pacmanDirection);
        let desired = Mat4.inverse(pacman_transform.times(Mat4.translation(0, 0, 10)));
        desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
        program_state.set_camera(desired);
    }
}
