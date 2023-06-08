// 必要なモジュールを読み込み
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { getRadian } from './helper/getRadian.js';

// DOM がパースされたことを検出するイベントを設定
window.addEventListener(
	'DOMContentLoaded',
	() => {
		// 制御クラスのインスタンスを生成
		const app = new App3();
		// 初期化
		app.init();
		// 描画
		app.render();
	},
	false
);

/**
 * three.js を効率よく扱うために自家製の制御クラスを定義
 */
class App3 {
	// カメラの設定
	static get CAMERA_PARAM() {
		return {
			fovy: 80,
			aspect: window.innerWidth / window.innerHeight,
			near: 0.1,
			far: 10.0,
			x: -0.75,
			y: 0.5,
			z: 3,
			lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
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
	static FAN_PARAM = {
		COLOR: {
			brade: 0xffffff,
			wire: 0xcccccc,
		},
		BRADE_COUNT: 7, // ブレードの数
		HEAD_R: 1, // ヘッド部分の半径
		HEAD_DEPTH: 0.4, // ヘッド部分の奥行き
		WIRE_R: 0.008, // ワイヤーの半径
		NECK_LENGTH: 1,
	};

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
		this.cameraRad = 0;
		this.renderer; // レンダラ
		this.scene; // シーン
		this.camera; // カメラ
		this.controls; // オービットコントロール

		// 扇風機
		this.fanGroup;
		this.blades;

		this.topGroup;

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
		this.fanGroup.add(this.headGroup);

		// body部分
		this.bodyGroup = new THREE.Group();
		this.createBody();
		this.fanGroup.add(this.bodyGroup);

		// 扇風機全体のグループをシーンに追加
		this.scene.add(this.fanGroup);

		// キー操作できるようにグループを配列に保存しておく
		// this.boxGroups.push({ group, perspective, r });

		// OrbitControls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		// 軸ヘルパー
		this.scene.add(new THREE.AxesHelper(5.0));
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
		this.camera.lookAt(App3.CAMERA_PARAM.lookAt);
	}

	/**
	 * ライトのセットアップ
	 */
	setupLighting() {
		// ディレクショナルライト（平行光源）
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(1.0, 1.0, 2.0); // xyzでベクトル指定

		// アンビエントライト（環境光）
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);

		// 点光源
		const pointLight = new THREE.PointLight(0xbb99ee, 0.5, 50);
		pointLight.position.set(0, 0, 0);
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
				App3.FAN_PARAM.HEAD_R * 0.85,
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
		const FRONT_Z = App3.FAN_PARAM.HEAD_DEPTH / 2;

		// ワイヤー部分
		this.createCircleWires(4, FRONT_Z, this.headGroup, 2);
		this.createLineWires(20, FRONT_Z, this.headGroup);

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
		centerMesh.position.set(0, 0, FRONT_Z);
		this.headGroup.add(centerMesh);

		// ヘッドグループに追加
		// this.headGroup.add(this.headFront);
	}

	// ヘッド部分前面
	createHeadBack() {
		// this.headBack = new THREE.Group();

		const BACK_Z = -App3.FAN_PARAM.HEAD_DEPTH / 2;

		// ワイヤー部分
		this.createLineWires(5, BACK_Z, this.headGroup);
		this.createCircleWires(10, BACK_Z, this.headGroup, 2);

		// 首の部分
		// const NECK_LENGTH = App3.FAN_PARAM.HEAD_DEPTH * 2.5;
		const neckMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(
				App3.FAN_PARAM.HEAD_R / 2.5,
				App3.FAN_PARAM.HEAD_R / 2.5,
				App3.FAN_PARAM.NECK_LENGTH
			),
			App3.MATERIALS.wire
		);
		neckMesh.rotation.x = getRadian(90);
		neckMesh.position.set(
			0,
			0,
			-(App3.FAN_PARAM.NECK_LENGTH / 2) - App3.FAN_PARAM.HEAD_DEPTH / 2
		);
		this.headGroup.add(neckMesh);

		// トップグループをシーンに追加する
		// this.headGroup.add(this.headBack);
	}

	/**
	 * ボディ
	 */
	createBody() {
		// this.bodyGroup.add(centerMesh);

		const BODY_HEIGHT = App3.FAN_PARAM.NECK_LENGTH * 3;
		const bodyMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(
				App3.FAN_PARAM.HEAD_R / 4,
				App3.FAN_PARAM.HEAD_R / 4,
				BODY_HEIGHT
			),
			App3.MATERIALS.wire
		);
		bodyMesh.position.set(
			0,
			-(BODY_HEIGHT / 2),
			-(App3.FAN_PARAM.NECK_LENGTH / 2) - App3.FAN_PARAM.HEAD_DEPTH / 2
		);
		// NECK_LENGTH
		this.bodyGroup.add(bodyMesh);
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループの設定
		requestAnimationFrame(this.render);

		// コントロールを更新 memo: なくても動いた
		// this.controls.update();

		this.blades.rotation.z += 0.01;

		// レンダラーで描画
		this.renderer.render(this.scene, this.camera);
	}
}
