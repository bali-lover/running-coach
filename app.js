class RunningCoach {
    constructor() {
        this.isRunning = false;
        this.targetPaceSeconds = 330; // 5분 30초 = 330초
        this.currentPosition = null;
        this.lastPosition = null;
        this.lastTime = null;
        this.distances = [];
        this.times = [];
        this.currentPace = 0;
        this.watchId = null;
        this.alertCooldown = false;
        this.wakeWord = '코치';
        this.isContinuousListening = false;
        this.recognitionActive = false;
        this.totalDistance = 0;
        this.totalTime = 0;
        this.startTime = null;
        this.lastKmTime = 0;
        this.kmPaces = [];

        this.initializeElements();
        this.initializeVoice();
        this.requestLocation();
    }

    initializeElements() {
        this.currentPaceEl = document.getElementById('currentPace');
        this.targetPaceEl = document.getElementById('targetPace');
        this.statusEl = document.getElementById('status');
        this.startBtn = document.getElementById('startBtn');
        this.targetMinEl = document.getElementById('targetMin');
        this.targetSecEl = document.getElementById('targetSec');
        this.wakeWordEl = document.getElementById('wakeWord');
        this.avgPaceEl = document.getElementById('avgPace');
        this.totalDistanceEl = document.getElementById('totalDistance');
        this.lastKmPaceEl = document.getElementById('lastKmPace');
    }

    initializeVoice() {
        // 음성 합성 초기화
        this.synth = window.speechSynthesis;

        // 음성 인식 초기화
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ko-KR';
            this.recognition.continuous = true;
            this.recognition.interimResults = true;

            this.recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript.toLowerCase();

                    if (event.results[i].isFinal) {
                        this.processVoiceInput(transcript);
                    }
                }
            };

            this.recognition.onend = () => {
                // 연속 듣기 모드일 때 자동 재시작
                if (this.isContinuousListening && this.isRunning) {
                    setTimeout(() => {
                        if (this.isContinuousListening) {
                            this.startListening();
                        }
                    }, 100);
                }
            };

            this.recognition.onerror = (event) => {
                console.log('음성 인식 오류:', event.error);
                if (event.error === 'no-speech' && this.isContinuousListening) {
                    // 말이 없으면 다시 시작
                    setTimeout(() => {
                        if (this.isContinuousListening) {
                            this.startListening();
                        }
                    }, 1000);
                }
            };
        }
    }

    speak(text) {
        if (this.synth) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            this.synth.speak(utterance);
        }
    }

    processVoiceInput(transcript) {
        console.log('음성 입력:', transcript);

        // 깨우기 단어 확인
        if (transcript.includes(this.wakeWord)) {
            console.log('깨우기 단어 감지:', this.wakeWord);

            // 깨우기 단어 이후의 명령 추출
            const commandIndex = transcript.indexOf(this.wakeWord) + this.wakeWord.length;
            const command = transcript.substring(commandIndex).trim();

            if (command) {
                this.processVoiceCommand(command);
            }
        }
    }

    processVoiceCommand(command) {
        console.log('음성 명령:', command);

        if (command.includes('목표') && command.includes('변경')) {
            // 숫자 추출해서 목표 변경
            const numbers = command.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                const min = parseInt(numbers[0]);
                const sec = parseInt(numbers[1]);
                this.setTargetPace(min, sec);
                this.speak(`목표를 ${min}분 ${sec}초로 설정했습니다`);
            }
        } else if (command.includes('현재') && command.includes('페이스')) {
            const pace = this.formatPace(this.currentPace);
            this.speak(`현재 ${pace} 페이스로 달리고 있습니다`);
        } else if (command.includes('일시정지') || command.includes('멈춰')) {
            if (this.isRunning) {
                this.toggleRunning();
                this.speak('러닝을 일시정지합니다');
            }
        } else if (command.includes('시작') || command.includes('재개')) {
            if (!this.isRunning) {
                this.toggleRunning();
                this.speak('러닝을 시작합니다');
            }
        } else if (command.includes('격려') || command.includes('응원')) {
            const encouragements = [
                '잘하고 있어요! 힘내세요!',
                '멋진 페이스네요! 계속 가세요!',
                '조금만 더! 할 수 있어요!',
                '훌륭해요! 꾸준히 가세요!'
            ];
            const random = Math.floor(Math.random() * encouragements.length);
            this.speak(encouragements[random]);
        }
    }

    requestLocation() {
        if (!navigator.geolocation) {
            this.statusEl.textContent = 'GPS를 지원하지 않는 브라우저입니다';
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.statusEl.textContent = 'GPS 준비 완료';
                this.currentPosition = position;
            },
            (error) => {
                this.statusEl.textContent = 'GPS 권한을 허용해주세요';
                console.error('GPS 오류:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );
    }

    setTargetPace(min = null, sec = null) {
        const minutes = min || parseInt(this.targetMinEl.value) || 5;
        const seconds = sec || parseInt(this.targetSecEl.value) || 30;

        this.targetPaceSeconds = minutes * 60 + seconds;
        this.targetPaceEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // 입력 필드 초기화
        this.targetMinEl.value = '';
        this.targetSecEl.value = '';
    }

    toggleRunning() {
        if (this.isRunning) {
            this.stopRunning();
        } else {
            this.startRunning();
        }
    }

    startRunning() {
        if (!navigator.geolocation) {
            alert('GPS를 사용할 수 없습니다');
            return;
        }

        this.isRunning = true;
        this.startBtn.textContent = '정지';
        this.startBtn.className = 'stop-btn';
        this.statusEl.textContent = '러닝 중...';

        this.lastPosition = null;
        this.lastTime = null;
        this.distances = [];
        this.times = [];
        this.totalDistance = 0;
        this.totalTime = 0;
        this.startTime = Date.now();
        this.lastKmDistance = 0;
        this.kmPaces = [];

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updatePosition(position);
            },
            (error) => {
                console.error('GPS 추적 오류:', error);
                this.statusEl.textContent = 'GPS 신호를 찾고 있습니다...';
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 15000
            }
        );

        this.speak('러닝을 시작합니다');
    }

    stopRunning() {
        this.isRunning = false;
        this.startBtn.textContent = '시작하기';
        this.startBtn.className = 'start-btn';
        this.statusEl.textContent = 'GPS 준비 완료';

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        this.speak('러닝을 종료합니다');
    }

    updatePosition(position) {
        const currentTime = Date.now();

        if (this.lastPosition && this.lastTime) {
            const distance = this.calculateDistance(
                this.lastPosition.coords.latitude,
                this.lastPosition.coords.longitude,
                position.coords.latitude,
                position.coords.longitude
            );

            const timeDiff = (currentTime - this.lastTime) / 1000; // 초

            if (distance > 0.005 && timeDiff > 2) { // 5m 이상, 2초 이상
                this.distances.push(distance);
                this.times.push(timeDiff);
                this.totalDistance += distance;
                this.totalTime = (Date.now() - this.startTime) / 1000;

                // 최근 3개 데이터로 평균 계산 (더 실시간)
                if (this.distances.length > 3) {
                    this.distances.shift();
                    this.times.shift();
                }

                this.calculatePace();
                this.updateStats();
                this.checkKmPace();
                this.checkPaceAlert();
            }
        }

        this.lastPosition = position;
        this.lastTime = currentTime;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 지구 반지름 (km)
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degree) {
        return degree * (Math.PI / 180);
    }

    calculatePace() {
        if (this.distances.length === 0) return;

        const totalDistance = this.distances.reduce((sum, d) => sum + d, 0);
        const totalTime = this.times.reduce((sum, t) => sum + t, 0);

        if (totalDistance > 0) {
            // 페이스 = 시간(초) / 거리(km)
            this.currentPace = totalTime / totalDistance;
            this.currentPaceEl.textContent = this.formatPace(this.currentPace);
        }
    }

    formatPace(paceInSeconds) {
        if (paceInSeconds === 0) return '0:00';

        const minutes = Math.floor(paceInSeconds / 60);
        const seconds = Math.floor(paceInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateStats() {
        // 평균 페이스 계산
        if (this.totalDistance > 0) {
            const avgPaceSeconds = this.totalTime / this.totalDistance;
            this.avgPaceEl.textContent = this.formatPace(avgPaceSeconds);
        }

        // 총 거리 표시
        this.totalDistanceEl.textContent = `${this.totalDistance.toFixed(2)}km`;

        // 최근 1km 페이스 표시
        if (this.kmPaces.length > 0) {
            const lastKmPace = this.kmPaces[this.kmPaces.length - 1];
            this.lastKmPaceEl.textContent = this.formatPace(lastKmPace);
        }
    }

    checkKmPace() {
        // 1km마다 페이스 기록
        const currentKm = Math.floor(this.totalDistance);
        const lastRecordedKm = Math.floor(this.lastKmDistance);

        if (currentKm > lastRecordedKm && this.totalDistance >= 1) {
            // 새로운 1km 완주
            const kmTime = this.totalTime - this.lastKmTime;
            const kmPace = kmTime; // 1km에 걸린 시간이 곧 페이스

            this.kmPaces.push(kmPace);
            this.lastKmTime = this.totalTime;
            this.lastKmDistance = this.totalDistance;

            // 1km 완주 알림
            this.speak(`${currentKm}킬로미터 완주! 페이스 ${this.formatPace(kmPace)}`);
        }
    }

    checkPaceAlert() {
        if (this.alertCooldown || this.currentPace === 0) return;

        const tolerance = 10; // 10초 허용 오차
        const paceDiff = this.currentPace - this.targetPaceSeconds;

        if (Math.abs(paceDiff) > tolerance) {
            let message = '';

            if (paceDiff > 0) {
                // 현재가 목표보다 느림
                const currentFormatted = this.formatPace(this.currentPace);
                message = `현재 ${currentFormatted} 페이스입니다. 속도를 올리세요`;
            } else {
                // 현재가 목표보다 빠름
                const currentFormatted = this.formatPace(this.currentPace);
                message = `현재 ${currentFormatted} 페이스입니다. 페이스를 줄이세요`;
            }

            this.speak(message);

            // 30초 쿨다운
            this.alertCooldown = true;
            setTimeout(() => {
                this.alertCooldown = false;
            }, 30000);
        }
    }

    setWakeWord() {
        const newWakeWord = this.wakeWordEl.value.trim();
        if (newWakeWord) {
            this.wakeWord = newWakeWord;
            this.speak(`깨우기 단어를 ${newWakeWord}로 설정했습니다`);
            this.wakeWordEl.value = '';
        }
    }

    startListening() {
        if (this.recognition && !this.recognitionActive) {
            try {
                this.recognition.start();
                this.recognitionActive = true;
            } catch (e) {
                console.log('음성 인식 시작 오류:', e);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.recognitionActive) {
            this.recognition.stop();
            this.recognitionActive = false;
        }
    }

    toggleContinuousListening() {
        if (!this.recognition) {
            alert('음성 인식을 지원하지 않는 브라우저입니다');
            return;
        }

        if (this.isContinuousListening) {
            this.isContinuousListening = false;
            this.stopListening();
            this.speak('음성 대기를 중지합니다');
            document.querySelector('button[onclick="toggleContinuousListening()"]').textContent = '🎤 음성 대기 시작';
        } else {
            this.isContinuousListening = true;
            this.startListening();
            this.speak(`${this.wakeWord} 라고 말해서 명령해주세요`);
            document.querySelector('button[onclick="toggleContinuousListening()"]').textContent = '🔇 음성 대기 중지';
        }
    }

    toggleVoiceCommand() {
        if (this.recognition) {
            this.speak('음성 명령을 말해주세요');
            this.recognition.start();
        } else {
            alert('음성 인식을 지원하지 않는 브라우저입니다');
        }
    }
}

// 앱 초기화
window.addEventListener('load', () => {
    const coach = new RunningCoach();

    // 전역 함수로 노출
    window.setTargetPace = () => coach.setTargetPace();
    window.toggleRunning = () => coach.toggleRunning();
    window.toggleVoiceCommand = () => coach.toggleVoiceCommand();
    window.setWakeWord = () => coach.setWakeWord();
    window.toggleContinuousListening = () => coach.toggleContinuousListening();
});

// PWA 설치 이벤트
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // 설치 버튼 표시 로직 추가 가능
    console.log('PWA 설치 가능');
});