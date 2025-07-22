// FastBot Web Application Configuration
// Modify these settings to match your robot setup

const ROBOT_CONFIG = {
    // Robot namespace and topics
    namespace: 'fastbot_1',
    topics: {
        cmd_vel: '/fastbot_1/cmd_vel',
        odom: '/fastbot_1/odom',
        scan: '/fastbot_1/scan',
        camera: '/fastbot_1/camera/image_raw',
        map: '/map',
        nav_goal: '/move_base_simple/goal',
        battery: '/fastbot_1/battery_state' // Optional
    },
    
    // Frame IDs
    frames: {
        map: 'map',
        base_link: 'fastbot_1_base_link',
        odom: 'fastbot_1_odom',
        lidar: 'fastbot_1_lidar'
    },
    
    // Robot physical parameters
    robot: {
        radius: 0.2,           // Robot radius in meters
        max_linear_speed: 0.5,  // Maximum linear speed in m/s
        max_angular_speed: 1.0, // Maximum angular speed in rad/s
        max_linear_accel: 2.5,  // Maximum linear acceleration
        max_angular_accel: 3.2  // Maximum angular acceleration
    },
    
    // Waypoint positions (adjust these based on your map)
    waypoints: {
        'kitchen': { 
            x: 2.0, 
            y: 1.0, 
            theta: 0.0,
            name: '🍽️ Kitchen',
            description: 'Navigate to the kitchen area'
        },
        'living_room': { 
            x: 0.0, 
            y: 2.0, 
            theta: 1.57,
            name: '🛋️ Living Room',
            description: 'Navigate to the living room'
        },
        'bedroom': { 
            x: -2.0, 
            y: 1.0, 
            theta: 3.14,
            name: '🛏️ Bedroom',
            description: 'Navigate to the bedroom'
        },
        'bathroom': { 
            x: -1.0, 
            y: -1.0, 
            theta: -1.57,
            name: '🚿 Bathroom',
            description: 'Navigate to the bathroom'
        },
        'entrance': { 
            x: 0.0, 
            y: -2.0, 
            theta: 0.0,
            name: '🚪 Entrance',
            description: 'Navigate to the entrance'
        },
        'home': { 
            x: 0.0, 
            y: 0.0, 
            theta: 0.0,
            name: '🏠 Home',
            description: 'Return to home position'
        }
    },
    
    // Camera settings
    camera: {
        width: 640,
        height: 480,
        fps: 30,
        quality: 80,
        port: 11315  // Web video server port
    },
    
    // Visualization settings
    visualization: {
        map: {
            width: 400,
            height: 300,
            background_color: '#222222'
        },
        robot_3d: {
            width: 400,
            height: 300,
            background_color: '#222222',
            grid_size: 0.5,
            grid_cells: 20,
            show_axes: true,
            show_grid: true
        },
        joystick: {
            size: 120,
            dead_zone: 0.1,
            color: 'grey'
        }
    },
    
    // Network settings
    network: {
        rosbridge_port: 9090,
        video_server_port: 11315,
        connection_timeout: 5000,
        reconnect_attempts: 3,
        reconnect_delay: 2000
    },
    
    // UI settings
    ui: {
        update_rate: 10,        // Hz
        position_decimals: 2,
        speed_decimals: 2,
        angle_decimals: 1,
        battery_update_interval: 5000, // ms
        status_colors: {
            connected: '#28a745',
            disconnected: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        }
    },
    
    // Safety settings
    safety: {
        emergency_stop_timeout: 100,    // ms
        max_joystick_publish_rate: 20,  // Hz
        collision_detection: true,
        path_planning_timeout: 30000,   // ms
        navigation_tolerance: {
            xy: 0.25,      // meters
            yaw: 0.25      // radians
        }
    },
    
    // Debug settings
    debug: {
        show_console_logs: true,
        show_tf_frames: false,
        show_robot_footprint: true,
        show_laser_scan: true,
        log_level: 'info' // 'debug', 'info', 'warn', 'error'
    }
};

// Utility functions for configuration
const CONFIG_UTILS = {
    // Get topic name with namespace
    getTopic: (topicName) => {
        return ROBOT_CONFIG.topics[topicName] || `/${ROBOT_CONFIG.namespace}/${topicName}`;
    },
    
    // Get frame ID with namespace
    getFrame: (frameName) => {
        return ROBOT_CONFIG.frames[frameName] || `${ROBOT_CONFIG.namespace}_${frameName}`;
    },
    
    // Get waypoint by name
    getWaypoint: (name) => {
        return ROBOT_CONFIG.waypoints[name];
    },
    
    // Get camera stream URL
    getCameraURL: (host = 'localhost') => {
        const port = ROBOT_CONFIG.camera.port;
        const topic = ROBOT_CONFIG.topics.camera;
        return `http://${host}:${port}/stream?topic=${topic}&type=mjpeg&quality=${ROBOT_CONFIG.camera.quality}`;
    },
    
    // Get ROSBridge URL
    getROSBridgeURL: (host = 'localhost') => {
        const port = ROBOT_CONFIG.network.rosbridge_port;
        return `ws://${host}:${port}`;
    },
    
    // Validate waypoint
    isValidWaypoint: (waypoint) => {
        return waypoint && 
               typeof waypoint.x === 'number' && 
               typeof waypoint.y === 'number' && 
               typeof waypoint.theta === 'number';
    },
    
    // Clamp value to robot limits
    clampLinearSpeed: (speed) => {
        return Math.max(-ROBOT_CONFIG.robot.max_linear_speed, 
                       Math.min(ROBOT_CONFIG.robot.max_linear_speed, speed));
    },
    
    clampAngularSpeed: (speed) => {
        return Math.max(-ROBOT_CONFIG.robot.max_angular_speed, 
                       Math.min(ROBOT_CONFIG.robot.max_angular_speed, speed));
    },
    
    // Log with level checking
    log: (level, message, ...args) => {
        if (!ROBOT_CONFIG.debug.show_console_logs) return;
        
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevel = levels.indexOf(ROBOT_CONFIG.debug.log_level);
        const messageLevel = levels.indexOf(level);
        
        if (messageLevel >= currentLevel) {
            console[level](`[FastBot] ${message}`, ...args);
        }
    }
};

// Export configuration (for use in main application)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ROBOT_CONFIG, CONFIG_UTILS };
}