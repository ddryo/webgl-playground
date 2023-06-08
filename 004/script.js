// 必要なモジュールを読み込み
// import * as THREE from './lib/three.module.js';
// 必要なモジュールを読み込み
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ポストプロセス用のファイル群を追加
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
// import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { SepiaShader } from 'three/addons/shaders/SepiaShader.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 自作
import { getRadian } from './helper/getRadian.js';

// DOM がパースされたことを検出するイベントで App3 クラスをインスタンス化する
window.addEventListener(
	'DOMContentLoaded',
	() => {
		const app = new App3();

		// 画像をロードしテクスチャを初期化する（Promise による非同期処理） @@@
		app.load().then(() => {
			// ロードが終わってから初期化し、描画する
			app.init();
			app.render();
		});
	},
	false
);

/**
 * three.js を効率よく扱うために自家製の制御クラスを定義
 */
class App3 {
	static TEXURES = {
		floor: './texture/tatami_1024.jpg',
		wall: './texture/wall_1024.jpg',
	};
	// カメラの設定
	static get CAMERA_PARAM() {
		return {
			fovy: 60,
			aspect: window.innerWidth / window.innerHeight,
			near: 0.1,
			far: 40.0,
			x: 0,
			y: 2,
			z: 6,
			lookAt: new THREE.Vector3(0.0, 2.0, 0.0),
		};
	}

	// レンダラーの設定
	static get RENDERER_PARAM() {
		return {
			clearColor: 0x222222, // レンダラーが背景をリセットする際に使われる背景色
			width: window.innerWidth,
			height: window.innerHeight,
		};
	}

	// 扇風機の設定
	static get FAN_PARAM() {
		const HEAD_R = 1;
		const HEAD_DEPTH = HEAD_R * 0.35;
		const NECK_LENGTH = HEAD_R * 0.9;
		// const NeckRotationAxis
		const NECK_AXIS_Z = -NECK_LENGTH / 2.5 - HEAD_DEPTH / 2;
		return {
			COLOR: {
				brade: 0xffffff,
				wire: 0xeeeeee,
			},
			BRADE_COUNT: 7, // ブレードの数
			HEAD_R, // ヘッド部分の半径
			HEAD_DEPTH: HEAD_DEPTH, // ヘッド部分の奥行き
			HEAD_Z: HEAD_DEPTH / 2,
			NECK_R: HEAD_R / 3,
			NECK_LENGTH: HEAD_R * 0.9,
			POLE_R: HEAD_R / 6,
			POLE_HEIGHT: HEAD_R * 3,
			WIRE_R: HEAD_R * 0.008, // ワイヤーの半径
			FOOT_R: HEAD_R * 1,
			FOOT_HEIGHT: HEAD_R * 0.1,
			NECK_AXIS_Z,
		};
	}

	static get MATERIALS() {
		return {
			brade: new THREE.MeshStandardMaterial({
				color: App3.FAN_PARAM.COLOR.brade,
				side: THREE.DoubleSide, // DoubleSide が必要なのは羽根部分だけだが面倒なので分けていない
			}),
			wire: new THREE.MeshStandardMaterial({
				color: App3.FAN_PARAM.COLOR.wire,
			}),
		};
	}

	/**
	 * コンストラクタ
	 * @constructor
	 */
	constructor() {
		this.renderer; // レンダラ
		this.scene; // シーン
		this.camera; // カメラ
		this.controls; // オービットコントロール
		this.composer; // エフェクトコンポーザー @@@
		this.renderPass; // レンダーパス @@@
		this.glitchPass; // グリッチパス @@@
		this.useComposer = 1;
		this.texture = {
			floor: null,
			wall: null,
		};

		// 扇風機
		this.neckRotationFlag = false; // 首振り方向のフラグ

		// 再帰呼び出しのための this 固定
		this.render = this.render.bind(this);

		// リサイズイベント
		window.addEventListener(
			'resize',
			() => {
				this.renderer.setSize(window.innerWidth, window.innerHeight);
				this.camera.aspect = window.innerWidth / window.innerHeight;
				this.camera.updateProjectionMatrix();
			},
			false
		);
	}

	/**
	 * テクスチャのロード
	 */
	load() {
		return new Promise((resolve) => {
			const loadManager = new THREE.LoadingManager();
			const loader = new THREE.TextureLoader(loadManager);

			loader.load(App3.TEXURES.floor, (texture) => {
				texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set(2, 2);
				this.texture.floor = texture;
				// this.texture.floor.repeat.set(4, 4);
			});
			loader.load(App3.TEXURES.wall, (texture) => {
				this.texture.wall = texture;
			});

			// 全部読み込みが終わったら resolve する
			loadManager.onLoad = () => {
				resolve();
			};
		});
	}

	/**
	 * 初期化処理
	 */
	init() {
		// レンダラー
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setClearColor(new THREE.Color(App3.RENDERER_PARAM.clearColor));
		this.renderer.setSize(App3.RENDERER_PARAM.width, App3.RENDERER_PARAM.height);
		const wrapper = document.querySelector('#webgl');
		wrapper.appendChild(this.renderer.domElement);

		// シーン
		this.scene = new THREE.Scene();

		this.setupCamera();
		this.setupLighting();

		// boxグループを保存する配列
		// this.boxGroups = [];

		this.fanGroup = new THREE.Group();

		// ヘッド部分
		this.headGroup = new THREE.Group();
		this.createBlades();
		this.createHeadFront();
		this.createHeadFrame();
		this.createHeadBack();

		// 首振りの回転軸を z = 0 に合わせる
		this.headGroup.position.set(0, 0, -App3.FAN_PARAM.NECK_AXIS_Z);

		// さらにグループをラップして首振りの回転軸の辻褄をあわせる
		this.headGroupWrap = new THREE.Group();
		this.headGroupWrap.add(this.headGroup);
		this.fanGroup.add(this.headGroupWrap);

		// body部分
		this.bodyGroup = new THREE.Group();
		this.createStand();
		this.fanGroup.add(this.bodyGroup);

		// 扇風機の底を y=0 に合わせる
		this.fanGroup.position.set(
			0,
			App3.FAN_PARAM.POLE_HEIGHT + App3.FAN_PARAM.FOOT_HEIGHT / 2,
			0
		);

		// 扇風機全体のグループをシーンに追加
		this.scene.add(this.fanGroup);

		this.roomGroup = new THREE.Group();
		this.createRoom();
		this.scene.add(this.roomGroup);

		// 軸ヘルパー
		// this.scene.add(new THREE.AxesHelper(5.0));

		// コンポーザーの設定 @@@
		if (this.useComposer) {
			// 1. コンポーザーにレンダラを渡して初期化する
			this.composer = new EffectComposer(this.renderer);
			// 2. コンポーザーに、まず最初に「レンダーパス」を設定する
			this.renderPass = new RenderPass(this.scene, this.camera);
			// this.composer.addPass(this.renderPass);

			// RenderPixelatedPass使ってみる
			const renderPixelatedPass = new RenderPixelatedPass(1, this.scene, this.camera, {
				normalEdgeStrength: 0.1, // 0~2?
				// depthEdgeStrength: 0.1, // 0~1?
			});
			this.composer.addPass(renderPixelatedPass);

			const shaderSepia = SepiaShader;
			const effectSepia = new ShaderPass(shaderSepia);
			effectSepia.uniforms['amount'].value = 0.1;
			this.composer.addPass(effectSepia);

			// const effectBloom = new BloomPass(0.99, 4, 0.01, 1024);
			// this.composer.addPass(effectBloom);

			const effectFilm = new FilmPass(0.2, 0.25, 648, false);
			this.composer.addPass(effectFilm);
		}
	}

	/**
	 * カメラのセットアップ
	 */
	setupCamera() {
		// カメラ
		this.camera = new THREE.PerspectiveCamera(
			App3.CAMERA_PARAM.fovy,
			App3.CAMERA_PARAM.aspect,
			App3.CAMERA_PARAM.near,
			App3.CAMERA_PARAM.far
		);
		this.camera.position.set(App3.CAMERA_PARAM.x, App3.CAMERA_PARAM.y, App3.CAMERA_PARAM.z);
		// this.camera.lookAt(App3.CAMERA_PARAM.lookAt);

		// OrbitControls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.target = App3.CAMERA_PARAM.lookAt; // カメラ方向の初期値
		this.controls.update();
	}

	/**
	 * ライトのセットアップ
	 */
	setupLighting() {
		// ディレクショナルライト（平行光源）
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(1.0, 1.0, 2.0); // xyzでベクトル指定

		// アンビエントライト（環境光）
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

		// 点光源
		// const pointLight = new THREE.PointLight(0xbb99ee, 0.5, 50);
		// pointLight.position.set(0, 0, 0);
		// pointLight.castShadow = true; // 影を落とす設定。（高負荷）

		// 各ライトをシーンに追加
		this.scene.add(directionalLight);
		this.scene.add(ambientLight);
		// this.scene.add(pointLight);

		// 照明を可視化するヘルパー
		// this.scene.add(new THREE.PointLightHelper(pointLight));
	}

	// 扇風機の羽根を作成
	createBlades() {
		this.blades = new THREE.Group();

		const bradeCenterR = App3.FAN_PARAM.HEAD_R / 4;
		const bradeCenterGeo = new THREE.CylinderGeometry(bradeCenterR, bradeCenterR, 0.1);

		const bradeCenterMesh = new THREE.Mesh(bradeCenterGeo, App3.MATERIALS.brade);
		bradeCenterMesh.rotation.x = getRadian(90);
		this.blades.add(bradeCenterMesh);

		const BRADE_COUNT = App3.FAN_PARAM.BRADE_COUNT;
		for (let i = 1; i <= BRADE_COUNT; i++) {
			// ブレードサイズは個数に合わせて計算。 隙間を空けるために1.5倍してる
			const bladesSize = getRadian(360 / (BRADE_COUNT * 1.5));

			// 各ブレードが描画され始める角度
			const thetaStart = getRadian((360 / BRADE_COUNT) * i);

			const bradeGeometry = new THREE.RingGeometry(
				bradeCenterR,
				App3.FAN_PARAM.HEAD_R * 0.9,
				32,
				0,
				thetaStart,
				bladesSize
			);
			// mesh.position.z = 0;
			this.blades.add(new THREE.Mesh(bradeGeometry, App3.MATERIALS.brade));
		}

		// return this.blades;
		this.headGroup.add(this.blades);
	}

	createHeadFrame() {
		const frameBodyGeo = new THREE.CylinderGeometry(
			App3.FAN_PARAM.HEAD_R,
			App3.FAN_PARAM.HEAD_R,
			App3.FAN_PARAM.HEAD_DEPTH,
			40,
			1,
			true
		);

		const frameBodyMesh = new THREE.Mesh(
			frameBodyGeo,
			new THREE.MeshStandardMaterial({
				color: App3.FAN_PARAM.COLOR.wire,
				side: THREE.DoubleSide,
			})
		);
		frameBodyMesh.rotation.x = getRadian(90);
		this.headGroup.add(frameBodyMesh);

		const frameWireGeo = new THREE.TorusGeometry(
			App3.FAN_PARAM.HEAD_R,
			App3.FAN_PARAM.WIRE_R,
			12,
			80
		);
		// const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
		const frameFront = new THREE.Mesh(frameWireGeo, App3.MATERIALS.wire);
		const frameBack = frameFront.clone();

		frameFront.position.set(0, 0, App3.FAN_PARAM.HEAD_DEPTH / 2);
		frameBack.position.set(0, 0, -App3.FAN_PARAM.HEAD_DEPTH / 2);
		this.headGroup.add(frameFront);
		this.headGroup.add(frameBack);
	}

	/**
	 * 直線ワイヤーを作成
	 */
	createLineWires(wireCount, zPosition, parentGroup) {
		// const wireCount = 20; // BOXの個数
		const r = 0; // BOXを配置する円周の半径

		const lineGeo = new THREE.CylinderGeometry(App3.FAN_PARAM.WIRE_R, App3.FAN_PARAM.WIRE_R, 2);

		// 中心で回転させてるので180度で計算
		const INCREMENT_RAD_BOX = getRadian(180 / wireCount);

		// 指定された個数のBOXの座標をそれぞれ計算してGrupに追加する
		for (let i = 0; i < wireCount; i++) {
			// Mesh生成
			const lineMesh = new THREE.Mesh(lineGeo, App3.MATERIALS.wire);

			// 配置座標を 角度[rad] と 半径r から計算し、xy平面上に配置
			const x = r * Math.cos(i * INCREMENT_RAD_BOX);
			const y = r * Math.sin(i * INCREMENT_RAD_BOX);
			lineMesh.position.set(x, y, zPosition);

			lineMesh.rotation.z = i * INCREMENT_RAD_BOX + getRadian(90);

			// グループに追加する
			parentGroup.add(lineMesh);
		}
	}

	/**
	 * 円形ワイヤーを作成
	 */
	createCircleWires(wireCount, zPosition, parentGroup, skipCount = 0) {
		// const wireCount = 10;
		for (let i = 0; i < wireCount; i++) {
			const r = (App3.FAN_PARAM.HEAD_R / wireCount) * i;
			// Mesh生成
			const lineGeo = new THREE.TorusGeometry(r, App3.FAN_PARAM.WIRE_R, 12, 40);
			const lineMesh = new THREE.Mesh(lineGeo, App3.MATERIALS.wire);

			lineMesh.position.set(0, 0, zPosition);

			if (skipCount > i) continue;

			// グループに追加する
			parentGroup.add(lineMesh);
		}
	}

	// ヘッド部分前面
	createHeadFront() {
		// this.headFront = new THREE.Group();

		// 前面部分のz座標
		const HEAD_DEPTH = App3.FAN_PARAM.HEAD_DEPTH;

		// ワイヤー部分
		this.createCircleWires(4, HEAD_DEPTH / 2, this.headGroup, 2);
		this.createLineWires(20, HEAD_DEPTH / 2, this.headGroup);

		// 中央の部分
		const centerMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(
				App3.FAN_PARAM.HEAD_R / 5,
				App3.FAN_PARAM.HEAD_R / 5,
				App3.FAN_PARAM.WIRE_R * 2.5
			),
			App3.MATERIALS.wire
		);
		centerMesh.rotation.x = getRadian(90);
		centerMesh.position.set(0, 0, HEAD_DEPTH / 2);
		this.headGroup.add(centerMesh);

		// ヘッドグループに追加
		// this.headGroup.add(this.headFront);
	}

	// ヘッド背面
	createHeadBack() {
		// this.headBack = new THREE.Group();

		const HEAD_DEPTH = App3.FAN_PARAM.HEAD_DEPTH;

		// ワイヤー部分
		this.createLineWires(5, -HEAD_DEPTH / 2, this.headGroup);
		this.createCircleWires(10, -HEAD_DEPTH / 2, this.headGroup, 4);

		// 中央の部分
		// const centerMesh = new THREE.Mesh(
		// 	new THREE.CylinderGeometry(
		// 		App3.FAN_PARAM.NECK_R,
		// 		App3.FAN_PARAM.NECK_R,
		// 		App3.FAN_PARAM.WIRE_R * 2.5
		// 	),
		// 	App3.MATERIALS.wire
		// );
		// centerMesh.rotation.x = getRadian(90);
		// centerMesh.position.set(0, 0, -HEAD_DEPTH / 2);
		// this.headGroup.add(centerMesh);

		// 首の部分
		// const NECK_LENGTH = App3.FAN_PARAM.HEAD_DEPTH * 2.5;
		const neckMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(
				App3.FAN_PARAM.NECK_R,
				App3.FAN_PARAM.NECK_R,
				App3.FAN_PARAM.NECK_LENGTH
			),
			App3.MATERIALS.wire
		);
		neckMesh.rotation.x = getRadian(90);
		neckMesh.position.set(
			0,
			0,
			-(App3.FAN_PARAM.NECK_LENGTH / 2) -
				App3.FAN_PARAM.HEAD_DEPTH / 2 +
				App3.FAN_PARAM.WIRE_R
		);
		this.headGroup.add(neckMesh);

		// トップグループをシーンに追加する
		// this.headGroup.add(this.headBack);
	}

	/**
	 * スタンド
	 */
	createStand() {
		const POLE_HEIGHT = App3.FAN_PARAM.POLE_HEIGHT;

		const poleMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(App3.FAN_PARAM.POLE_R, App3.FAN_PARAM.POLE_R, POLE_HEIGHT),
			App3.MATERIALS.wire
		);
		poleMesh.position.set(0, -(POLE_HEIGHT / 2), 0);
		this.bodyGroup.add(poleMesh);

		// 台
		// const App3.FAN_PARAM.POLE_HEIGHT = App3.FAN_PARAM.NECK_LENGTH * 3;
		const footMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(
				App3.FAN_PARAM.FOOT_R,
				App3.FAN_PARAM.FOOT_R * 0.95,
				App3.FAN_PARAM.FOOT_HEIGHT
			),
			App3.MATERIALS.wire
		);
		footMesh.position.set(0, -POLE_HEIGHT, 0);

		this.bodyGroup.add(footMesh);
	}

	/**
	 * 部屋
	 */
	createRoom() {
		this.roomGroup = new THREE.Group();
		// 床
		const floorMaterial = new THREE.MeshStandardMaterial({
			color: 0xcccccc,
			map: this.texture.floor,
		});

		const roomSize = 12;
		const floorMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(roomSize, roomSize),
			floorMaterial
		);
		floorMesh.position.set(0, 0, 0);
		floorMesh.rotation.x = getRadian(-90);
		this.roomGroup.add(floorMesh);

		// 壁
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: 0xcccccc,
			map: this.texture.wall,
		});

		const wallMesh1 = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), wallMaterial);
		wallMesh1.position.set(0, roomSize / 2, -roomSize / 2);
		this.roomGroup.add(wallMesh1);

		const wallMesh2 = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), wallMaterial);
		wallMesh2.position.set(roomSize / 2, roomSize / 2, 0);
		wallMesh2.rotation.y = getRadian(-90);
		this.roomGroup.add(wallMesh2);

		this.roomGroup.rotation.y = getRadian(45);
		this.scene.add(this.roomGroup);
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループの設定
		requestAnimationFrame(this.render);

		// コントロールを更新 memo: なくても動いた
		// this.controls.update();

		// 羽根の回転
		this.blades.rotation.z += 0.2;

		// 首振り制御
		if (this.headGroupWrap.rotation.y > getRadian(45)) {
			this.neckRotationFlag = false;
		} else if (this.headGroupWrap.rotation.y < getRadian(-45)) {
			this.neckRotationFlag = true;
		}
		if (this.neckRotationFlag) {
			this.headGroupWrap.rotation.y += 0.002;
		} else {
			this.headGroupWrap.rotation.y -= 0.002;
		}

		// レンダラーで描画
		if (this.useComposer) {
			this.composer.render();
		} else {
			this.renderer.render(this.scene, this.camera);
		}
	}
}
