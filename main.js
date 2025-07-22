var app = new Vue({
    el: '#app',
    data: {
        // Connection
        rosbridge_address: '',
        connected: false,
        loading: false,
        ros: null,
        
        // Robot Status
        robotStatus: {
            speed: 0.0,
            position: { x: 0.0, y: 0.0 },
            orientation: 0.0,
            battery: 100
        },
        
        // Control
        controlMode: 'Manual',
        isNavigating: false,
        
        // Visualization
        mapLoaded: false,
        robot3DLoaded: false,
        cameraLoaded: false,
        cameraStatus: 'Connecting to camera...',
        
        // ROS Topics
        cmdVelTopic: null,
        navGoalTopic: null,
        odomListener: null,
        
        // Visualization Objects
        map2D: null,
        robot3D: null,
        joystick: null,
        tfClient: null,
        
        // Waypoints from config
        waypoints: ROBOT_CONFIG.waypoints
    },
    
    methods: {
        connect: function() {
            this.loading = true;
            CONFIG_UTILS.log('info', 'Connecting to ROS at:', this.rosbridge_address);
            
            this.ros = new ROSLIB.Ros({
                url: this.rosbridge_address
            });
            
            this.ros.on('connection', () => {
                CONFIG_UTILS.log('info', 'Connected to ROS');
                this.connected = true;
                this.loading = false;
                this.setupROSCommunication();
                this.setupVisualization();
                this.setupCamera();
            });
            
            this.ros.on('error', (error) => {
                CONFIG_UTILS.log('error', 'ROS connection error:', error);
                this.connected = false;
                this.loading = false;
                alert('Failed to connect to ROS: ' + error);
            });
            
            this.ros.on('close', () => {
                CONFIG_UTILS.log('info', 'ROS connection closed');
                this.connected = false;
                this.loading = false;
                this.cleanup();
            });
        },
        
        disconnect: function() {
            if (this.ros) {
                this.ros.close();
            }
        },
        
        setupROSCommunication: function() {
            // Command velocity publisher
            this.cmdVelTopic = new ROSLIB.Topic({
                ros: this.ros,
                name: CONFIG_UTILS.getTopic('cmd_vel'),
                messageType: 'geometry_msgs/Twist'
            });
            
            // Navigation goal publisher
            this.navGoalTopic = new ROSLIB.Topic({
                ros: this.ros,
                name: CONFIG_UTILS.getTopic('nav_goal'),
                messageType: 'geometry_msgs/PoseStamped'
            });
            
            // Odometry listener
            this.odomListener = new ROSLIB.Topic({
                ros: this.ros,
                name: CONFIG_UTILS.getTopic('odom'),
                messageType: 'nav_msgs/Odometry'
            });
            
            this.odomListener.subscribe((message) => {
                this.updateRobotStatus(message);
            });
            
            // TF client for transforms
            this.tfClient = new ROSLIB.TFClient({
                ros: this.ros,
                angularThres: 0.01,
                transThres: 0.01,
                rate: ROBOT_CONFIG.ui.update_rate
            });
            
            CONFIG_UTILS.log('info', 'ROS communication setup complete');
        },
        
        setupVisualization: function() {
            this.setup2DMap();
            this.setup3DRobot();
            this.setupJoystick();
        },
        
        setup2DMap: function() {
            try {
                var mapContainer = document.getElementById('map-container');
                if (!mapContainer) return;
                
                mapContainer.innerHTML = '';
                
                this.map2D = new ROS2D.Viewer({
                    divID: 'map-container',
                    width: mapContainer.offsetWidth,
                    height: mapContainer.offsetHeight
                });
                
                // Add occupancy grid
                var gridClient = new ROS2D.OccupancyGridClient({
                    ros: this.ros,
                    rootObject: this.map2D.scene,
                    topic: CONFIG_UTILS.getTopic('map')
                });
                
                gridClient.on('change', () => {
                    this.mapLoaded = true;
                    CONFIG_UTILS.log('info', 'Map loaded successfully');
                });
                
                // Add robot marker
                var robotMarker = new ROS2D.NavigationArrow({
                    size: 20,
                    strokeSize: 2,
                    fillColor: createjs.Graphics.getRGB(255, 128, 0),
                    pulse: true
                });
                
                this.map2D.scene.addChild(robotMarker);
                
                // Update robot position on map
                if (this.tfClient) {
                    this.tfClient.subscribe(CONFIG_UTILS.getFrame('base_link'), (tf) => {
                        if (this.map2D && this.map2D.scene) {
                            robotMarker.x = tf.translation.x * this.map2D.scene.scaleX;
                            robotMarker.y = tf.translation.y * this.map2D.scene.scaleY;
                            robotMarker.rotation = tf.rotation.z * 180 / Math.PI;
                        }
                    });
                }
                
            } catch (error) {
                CONFIG_UTILS.log('error', 'Error setting up 2D map:', error);
            }
        },
        
        setup3DRobot: function() {
            try {
                var robotContainer = document.getElementById('robot-container');
                if (!robotContainer) return;
                
                robotContainer.innerHTML = '';
                
                this.robot3D = new ROS3D.Viewer({
                    divID: 'robot-container',
                    width: robotContainer.offsetWidth,
                    height: robotContainer.offsetHeight,
                    antialias: true,
                    background: ROBOT_CONFIG.visualization.robot_3d.background_color
                });
                
                // Add TF client for 3D
                var tfClient3D = new ROSLIB.TFClient({
                    ros: this.ros,
                    angularThres: 0.01,
                    transThres: 0.01,
                    rate: ROBOT_CONFIG.ui.update_rate,
                    fixedFrame: CONFIG_UTILS.getFrame('base_link')
                });
                
                // Add robot model (simplified box)
                var robotGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.2);
                var robotMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
                var robotMesh = new THREE.Mesh(robotGeometry, robotMaterial);
                this.robot3D.scene.add(robotMesh);
                
                // Add grid
                var gridHelper = new THREE.GridHelper(
                    ROBOT_CONFIG.visualization.robot_3d.grid_size, 
                    ROBOT_CONFIG.visualization.robot_3d.grid_divisions, 
                    0x444444, 
                    0x444444
                );
                this.robot3D.scene.add(gridHelper);
                
                // Add lights
                var ambientLight = new THREE.AmbientLight(0x404040, 0.4);
                this.robot3D.scene.add(ambientLight);
                
                var directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
                directionalLight.position.set(1, 1, 1);
                this.robot3D.scene.add(directionalLight);
                
                this.robot3DLoaded = true;
                CONFIG_UTILS.log('info', '3D robot model loaded');
                
            } catch (error) {
                CONFIG_UTILS.log('error', 'Error setting up 3D robot:', error);
            }
        },
        
        setupJoystick: function() {
            try {
                var joystickContainer = document.getElementById('joystick-container');
                if (!joystickContainer) return;
                
                this.joystick = nipplejs.create({
                    zone: joystickContainer,
                    mode: 'static',
                    position: { left: '50%', top: '50%' },
                    color: ROBOT_CONFIG.visualization.joystick.color,
                    size: ROBOT_CONFIG.visualization.joystick.size,
                    threshold: ROBOT_CONFIG.visualization.joystick.dead_zone,
                    restJoystick: true
                });
                
                this.joystick.on('move', (evt, data) => {
                    if (!this.connected || !this.cmdVelTopic) return;
                    
                    var maxDistance = ROBOT_CONFIG.visualization.joystick.size / 2;
                    var distance = Math.min(data.distance, maxDistance);
                    var angle = data.angle.radian;
                    
                    var linear = (distance / maxDistance) * ROBOT_CONFIG.robot.max_linear_speed;
                    var angular = -Math.sin(angle) * (distance / maxDistance) * ROBOT_CONFIG.robot.max_angular_speed;
                    
                    // Apply speed clamping
                    linear = CONFIG_UTILS.clampLinearSpeed(linear * Math.cos(angle));
                    angular = CONFIG_UTILS.clampAngularSpeed(angular);
                    
                    var message = new ROSLIB.Message({
                        linear: {
                            x: linear,
                            y: 0,
                            z: 0
                        },
                        angular: {
                            x: 0,
                            y: 0,
                            z: angular
                        }
                    });
                    
                    this.cmdVelTopic.publish(message);
                    this.controlMode = 'Manual';
                });
                
                this.joystick.on('end', () => {
                    if (!this.connected || !this.cmdVelTopic) return;
                    
                    var message = new ROSLIB.Message({
                        linear: { x: 0, y: 0, z: 0 },
                        angular: { x: 0, y: 0, z: 0 }
                    });
                    
                    this.cmdVelTopic.publish(message);
                });
                
                CONFIG_UTILS.log('info', 'Joystick setup complete');
                
            } catch (error) {
                CONFIG_UTILS.log('error', 'Error setting up joystick:', error);
            }
        },
        
        setupCamera: function() {
            try {
                var without_wss = this.rosbridge_address.split('wss://')[1];
                console.log(without_wss);
                var domain = without_wss.split('/')[0] + '/' + without_wss.split('/')[1];
                console.log(domain);
                var host = domain + '/cameras';
                
                var viewer = new MJPEGCANVAS.Viewer({
                    divID: 'camera-container',
                    host: host,
                    width: ROBOT_CONFIG.camera.width,
                    height: ROBOT_CONFIG.camera.height,
                    topic: CONFIG_UTILS.getTopic('camera'),
                    ssl: true,
                });
                
                this.cameraLoaded = true;
                this.cameraStatus = 'Camera connected';
                CONFIG_UTILS.log('info', 'Camera setup complete');
                
            } catch (error) {
                CONFIG_UTILS.log('error', 'Error setting up camera:', error);
                this.cameraStatus = 'Camera unavailable';
            }
        },
        
        updateRobotStatus: function(odomMessage) {
            try {
                var pose = odomMessage.pose.pose;
                var twist = odomMessage.twist.twist;
                
                // Update position
                this.robotStatus.position.x = pose.position.x;
                this.robotStatus.position.y = pose.position.y;
                
                // Update orientation (quaternion to euler)
                var quat = pose.orientation;
                var siny_cosp = 2 * (quat.w * quat.z + quat.x * quat.y);
                var cosy_cosp = 1 - 2 * (quat.y * quat.y + quat.z * quat.z);
                var theta = Math.atan2(siny_cosp, cosy_cosp);
                this.robotStatus.orientation = theta * 180 / Math.PI;
                
                // Update speed
                this.robotStatus.speed = Math.sqrt(
                    twist.linear.x * twist.linear.x + 
                    twist.linear.y * twist.linear.y
                );
                
            } catch (error) {
                CONFIG_UTILS.log('error', 'Error updating robot status:', error);
            }
        },
        
        goToWaypoint: function(waypointKey) {
            if (!this.connected || !this.navGoalTopic) {
                alert('Not connected to ROS');
                return;
            }
            
            var waypoint = CONFIG_UTILS.getWaypoint(waypointKey);
            if (!waypoint || !CONFIG_UTILS.isValidWaypoint(waypoint)) {
                alert('Invalid waypoint: ' + waypointKey);
                return;
            }
            
            this.isNavigating = true;
            this.controlMode = 'Navigation to ' + waypoint.name;
            CONFIG_UTILS.log('info', 'Navigating to waypoint:', waypoint.name);
            
            var goal = new ROSLIB.Message({
                header: {
                    frame_id: CONFIG_UTILS.getFrame('map'),
                    stamp: {
                        sec: Math.floor(Date.now() / 1000),
                        nanosec: (Date.now() % 1000) * 1000000
                    }
                },
                pose: {
                    position: {
                        x: waypoint.x,
                        y: waypoint.y,
                        z: 0.0
                    },
                    orientation: {
                        x: 0.0,
                        y: 0.0,
                        z: Math.sin(waypoint.theta / 2),
                        w: Math.cos(waypoint.theta / 2)
                    }
                }
            });
            
            this.navGoalTopic.publish(goal);
            
            // Re-enable navigation after timeout
            setTimeout(() => {
                this.isNavigating = false;
                this.controlMode = 'Manual';
            }, ROBOT_CONFIG.safety.path_planning_timeout / 6);
        },
        
        emergencyStop: function() {
            if (!this.connected || !this.cmdVelTopic) return;
            
            CONFIG_UTILS.log('warn', 'Emergency stop activated');
            
            var message = new ROSLIB.Message({
                linear: { x: 0, y: 0, z: 0 },
                angular: { x: 0, y: 0, z: 0 }
            });
            
            this.cmdVelTopic.publish(message);
            this.controlMode = 'EMERGENCY STOP';
            this.isNavigating = false;
            
            // Reset control mode after 3 seconds
            setTimeout(() => {
                this.controlMode = 'Manual';
            }, 3000);
        },
        
        cleanup: function() {
            // Clean up camera
            var cameraContainer = document.getElementById('camera-container');
            if (cameraContainer) {
                cameraContainer.innerHTML = '<div class="loading-text">Connecting to camera...</div>';
            }
            
            // Reset status
            this.mapLoaded = false;
            this.robot3DLoaded = false;
            this.cameraLoaded = false;
            this.cameraStatus = 'Connecting to camera...';
            this.controlMode = 'Manual';
            this.isNavigating = false;
            
            CONFIG_UTILS.log('info', 'Cleanup complete');
        }
    },
    
    mounted: function() {
        CONFIG_UTILS.log('info', 'FastBot Control Interface loaded');
        CONFIG_UTILS.log('info', 'Configuration loaded:', ROBOT_CONFIG);
        
        // Simulate battery level updates
        setInterval(() => {
            this.robotStatus.battery = Math.max(20, 100 - Math.random() * 3);
        }, ROBOT_CONFIG.ui.battery_update_interval);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(() => {
                if (this.map2D) {
                    var mapContainer = document.getElementById('map-container');
                    if (mapContainer) {
                        this.map2D.resize(mapContainer.offsetWidth, mapContainer.offsetHeight);
                    }
                }
                if (this.robot3D) {
                    var robotContainer = document.getElementById('robot-container');
                    if (robotContainer) {
                        this.robot3D.resize(robotContainer.offsetWidth, robotContainer.offsetHeight);
                    }
                }
            }, 100);
        });
    }
});