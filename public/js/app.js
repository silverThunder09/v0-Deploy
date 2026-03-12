// 전역 변수
let places = []; // 전체 맛집 목록 저장
let filteredPlaces = []; // 필터링된 맛집 목록 저장
let currentEditId = null; // 현재 수정 중인 맛집 ID 저장
let currentFilter = 'all'; // 현재 선택된 필터 저장

// 카카오맵 관련 전역 변수
let addMap = null; // 등록 모달용 지도 객체
let addMapMarker = null; // 등록 모달용 마커 객체
let kakaoPlaceService = null; // 카카오 장소 검색 서비스 객체
let kakaoGeocoder = null; // 카카오 주소 변환 서비스 객체

// DOM 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', function () {
  loadPlaces(); // 기존 맛집 목록 로드
  setupEventListeners(); // 이벤트 리스너 등록
  initializeKakaoMap(); // 카카오맵 초기화
});

// 이벤트 리스너 설정
function setupEventListeners() {
  // 등록 폼 제출 이벤트
  document.getElementById('addPlaceForm').addEventListener('submit', handleAddPlace);

  // 수정 폼 제출 이벤트
  document.getElementById('editPlaceForm').addEventListener('submit', handleEditPlace);

  // 카테고리 필터 탭 클릭 이벤트
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active')); // 기존 active 제거
      this.classList.add('active'); // 현재 탭 active 추가
      currentFilter = this.dataset.filter; // 현재 필터 변경
      filterPlaces(); // 목록 다시 필터링
    });
  });

  // 가게 이름으로 장소 검색 버튼 클릭 이벤트
  document.getElementById('searchPlaceByNameBtn').addEventListener('click', handleSearchPlaceByName);

  // 등록 모달이 열릴 때 지도 리사이즈 보정
  document.getElementById('addPlaceModal').addEventListener('shown.bs.modal', function () {
    if (addMap) {
      kakao.maps.event.trigger(addMap, 'resize'); // 숨겨진 모달 안 지도 깨짐 방지
      const center = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청 기본 좌표
      addMap.setCenter(center); // 지도 중심 재설정
    }
  });

  // 등록 모달 닫힐 때 폼 및 지도 초기화
  document.getElementById('addPlaceModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('addPlaceForm').reset(); // 등록 폼 초기화
    resetStarRating('add'); // 등록 별점 초기화
    clearSearchResults(); // 검색 결과 초기화
    clearAddMapSelection(); // 지도 선택값 초기화
  });

  // 수정 모달 닫힐 때 폼 초기화
  document.getElementById('editPlaceModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('editPlaceForm').reset(); // 수정 폼 초기화
    resetStarRating('edit'); // 수정 별점 초기화
    currentEditId = null; // 수정 ID 초기화
  });
}

// 카카오맵 초기화
function initializeKakaoMap() {
  if (!window.kakao || !window.kakao.maps) {
    console.error('Kakao Maps SDK가 로드되지 않았습니다.'); // SDK 로드 실패 시 종료
    return;
  }

  const mapContainer = document.getElementById('addMap'); // 지도 div 찾기
  if (!mapContainer) return; // 지도 div 없으면 종료

  const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청 기본 좌표
  const mapOption = {
    center: defaultCenter, // 초기 중심 좌표
    level: 3, // 지도 확대 레벨
  };

  addMap = new kakao.maps.Map(mapContainer, mapOption); // 지도 생성

  kakaoPlaceService = new kakao.maps.services.Places(); // 장소 검색 서비스 생성
  kakaoGeocoder = new kakao.maps.services.Geocoder(); // 주소 변환 서비스 생성

  // 지도 클릭 시 마커 이동 및 주소 자동 입력
  kakao.maps.event.addListener(addMap, 'click', function (mouseEvent) {
    const latLng = mouseEvent.latLng; // 클릭 좌표 추출
    setAddMapMarker(latLng); // 마커 위치 설정
    fillAddressByCoords(latLng); // 좌표를 주소로 변환해 입력
  });
}

// 가게 이름으로 장소 검색 처리
async function handleSearchPlaceByName() {
  const keyword = document.getElementById('addName').value.trim(); // 입력된 가게 이름 추출

  if (!keyword) {
    showValidationError('먼저 가게 이름을 입력해주세요.'); // 빈 값 검증
    return;
  }

  try {
    Swal.fire({
      title: '장소 검색 중...', // 로딩 제목
      allowOutsideClick: false, // 바깥 클릭 방지
      didOpen: () => Swal.showLoading(), // 로딩 스피너 표시
    });

    const results = await searchPlacesByKeyword(keyword); // 장소 검색 실행

    Swal.close(); // 로딩 닫기

    if (!results.length) {
      showValidationError('검색 결과가 없습니다. 다른 이름으로 다시 시도해주세요.'); // 검색 결과 없음 처리
      clearSearchResults(); // 결과 영역 초기화
      return;
    }

    renderSearchResults(results); // 검색 결과 목록 출력
  } catch (error) {
    Swal.fire({
      icon: 'error', // 에러 아이콘
      title: '검색 실패', // 에러 제목
      text: error.message, // 에러 메시지
      confirmButtonColor: '#2563eb', // 버튼 색상
    });
  }
}

// 카카오 장소명 검색
async function searchPlacesByKeyword(keyword) {
  return new Promise((resolve, reject) => {
    if (!kakaoPlaceService) {
      reject(new Error('카카오 장소 검색 서비스가 초기화되지 않았습니다.')); // 서비스 미초기화 예외
      return;
    }

    kakaoPlaceService.keywordSearch(keyword, function (data, status) {
      if (status === kakao.maps.services.Status.OK) {
        resolve(data); // 정상 결과 반환
        return;
      }

      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]); // 검색 결과 없음
        return;
      }

      reject(new Error('장소 검색 중 오류가 발생했습니다.')); // 기타 오류 처리
    });
  });
}

// 검색 결과 목록 렌더링
function renderSearchResults(results) {
  const container = document.getElementById('placeSearchResult'); // 결과 표시 영역 찾기

  container.innerHTML = results
    .slice(0, 5) // 상위 5개만 표시
    .map((place) => {
      const safeName = escapeHtml(place.place_name || ''); // 이름 XSS 방지
      const safeAddress = escapeHtml(place.road_address_name || place.address_name || ''); // 주소 XSS 방지
      const safePhone = escapeHtml(place.phone || ''); // 전화번호 XSS 방지

      return `
        <button
          type="button"
          class="w-100 text-start border rounded p-2 mb-2 bg-white"
          onclick="selectSearchResult('${safeName}', '${safeAddress}', '${safePhone}', '${place.y}', '${place.x}')"
        >
          <div class="fw-semibold">${safeName}</div>
          <div class="small text-muted">${safeAddress}</div>
          <div class="small text-muted">${safePhone || '전화번호 없음'}</div>
        </button>
      `;
    })
    .join('');
}

// 검색 결과 선택
window.selectSearchResult = function (name, address, phone, lat, lng) {
  const latLng = new kakao.maps.LatLng(Number(lat), Number(lng)); // 좌표 객체 생성

  document.getElementById('addName').value = name; // 이름 자동 입력
  document.getElementById('addAddress').value = address; // 주소 자동 입력

  if (phone) {
    document.getElementById('addCall').value = phone; // 전화번호 자동 입력
  }

  document.getElementById('addLat').value = lat; // 위도 저장
  document.getElementById('addLng').value = lng; // 경도 저장

  if (addMap) {
    addMap.setCenter(latLng); // 지도 중심 이동
  }

  setAddMapMarker(latLng); // 마커 표시

  Swal.fire({
    icon: 'success', // 성공 아이콘
    title: '장소 선택 완료', // 성공 제목
    text: '지도에서 위치를 한 번 더 클릭하면 정확한 위치로 수정할 수 있습니다.', // 안내 문구
    confirmButtonColor: '#2563eb', // 버튼 색상
    timer: 1800, // 자동 닫힘 시간
    timerProgressBar: true, // 진행바 표시
  });
};

// 등록 지도 마커 설정
function setAddMapMarker(latLng) {
  if (!addMapMarker) {
    addMapMarker = new kakao.maps.Marker({
      position: latLng, // 초기 마커 위치 설정
    });
  }

  addMapMarker.setPosition(latLng); // 마커 위치 변경
  addMapMarker.setMap(addMap); // 지도에 마커 표시

  document.getElementById('addLat').value = latLng.getLat(); // 위도 저장
  document.getElementById('addLng').value = latLng.getLng(); // 경도 저장
}

// 좌표로 주소 채우기
async function fillAddressByCoords(latLng) {
  try {
    const address = await getAddressFromCoords(latLng.getLng(), latLng.getLat()); // 좌표를 주소로 변환

    if (address) {
      document.getElementById('addAddress').value = address; // 주소 입력칸 자동 반영
    }
  } catch (error) {
    console.error('주소 변환 실패:', error); // 콘솔 에러 출력
  }
}

// 좌표 -> 주소 변환
async function getAddressFromCoords(lng, lat) {
  return new Promise((resolve, reject) => {
    if (!kakaoGeocoder) {
      reject(new Error('카카오 지오코더가 초기화되지 않았습니다.')); // 지오코더 미초기화 예외
      return;
    }

    kakaoGeocoder.coord2Address(lng, lat, function (result, status) {
      if (status !== kakao.maps.services.Status.OK) {
        reject(new Error('좌표를 주소로 변환하지 못했습니다.')); // 변환 실패
        return;
      }

      const first = result[0]; // 첫 번째 결과 선택
      const roadAddress = first.road_address ? first.road_address.address_name : ''; // 도로명 주소
      const jibunAddress = first.address ? first.address.address_name : ''; // 지번 주소

      resolve(roadAddress || jibunAddress || ''); // 도로명 우선, 없으면 지번
    });
  });
}

// 검색 결과 초기화
function clearSearchResults() {
  const container = document.getElementById('placeSearchResult'); // 결과 영역 찾기
  container.innerHTML = `
    <div class="text-muted small">가게 이름으로 검색하면 결과가 여기에 표시됩니다.</div>
  `; // 기본 안내 문구 복원
}

// 등록 지도 선택값 초기화
function clearAddMapSelection() {
  document.getElementById('addLat').value = ''; // 위도 초기화
  document.getElementById('addLng').value = ''; // 경도 초기화

  if (addMapMarker) {
    addMapMarker.setMap(null); // 기존 마커 제거
    addMapMarker = null; // 마커 객체 초기화
  }

  const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청 기본 좌표
  if (addMap) {
    addMap.setCenter(defaultCenter); // 지도 중심 복원
  }
}

// 맛집 등록 처리
async function handleAddPlace(e) {
  e.preventDefault(); // 기본 submit 방지

  const formData = {
    name: document.getElementById('addName').value.trim(), // 가게 이름
    address: document.getElementById('addAddress').value.trim(), // 주소
    category: document.getElementById('addCategory').value, // 카테고리
    call: document.getElementById('addCall').value.trim(), // 전화번호
    rating: parseInt(document.querySelector('input[name="addRating"]:checked')?.value || 0), // 별점
    lat: document.getElementById('addLat').value.trim(), // 위도
    lng: document.getElementById('addLng').value.trim(), // 경도
  };

  if (!validateAddForm(formData)) return; // 등록 전용 유효성 검사

  try {
    Swal.fire({
      title: '등록 중...', // 로딩 제목
      allowOutsideClick: false, // 바깥 클릭 방지
      didOpen: () => Swal.showLoading(), // 로딩 표시
    });

    await createPlace(formData); // 등록 API 호출

    Swal.fire({
      icon: 'success', // 성공 아이콘
      title: '등록 완료', // 성공 제목
      text: `'${formData.name}'이(가) 등록되었습니다.`, // 완료 메시지
      confirmButtonColor: '#2563eb', // 버튼 색상
      timer: 2000, // 자동 닫힘
      timerProgressBar: true, // 진행바
    });

    bootstrap.Modal.getInstance(document.getElementById('addPlaceModal')).hide(); // 등록 모달 닫기
    loadPlaces(); // 목록 다시 로드
  } catch (error) {
    Swal.fire({
      icon: 'error', // 에러 아이콘
      title: '등록 실패', // 에러 제목
      text: error.message, // 에러 메시지
      confirmButtonColor: '#2563eb', // 버튼 색상
    });
  }
}

// 맛집 수정 처리
async function handleEditPlace(e) {
  e.preventDefault(); // 기본 submit 방지

  const formData = {
    name: document.getElementById('editName').value.trim(), // 수정 이름
    address: document.getElementById('editAddress').value.trim(), // 수정 주소
    category: document.getElementById('editCategory').value, // 수정 카테고리
    call: document.getElementById('editCall').value.trim(), // 수정 전화번호
    rating: parseInt(document.querySelector('input[name="editRating"]:checked')?.value || 0), // 수정 별점
  };

  if (!validateEditForm(formData)) return; // 수정 전용 유효성 검사

  try {
    Swal.fire({
      title: '수정 중...', // 로딩 제목
      allowOutsideClick: false, // 바깥 클릭 방지
      didOpen: () => Swal.showLoading(), // 로딩 표시
    });

    await updatePlace(currentEditId, formData); // 수정 API 호출

    Swal.fire({
      icon: 'success', // 성공 아이콘
      title: '수정 완료', // 성공 제목
      text: `'${formData.name}'이(가) 수정되었습니다.`, // 완료 메시지
      confirmButtonColor: '#2563eb', // 버튼 색상
      timer: 2000, // 자동 닫힘
      timerProgressBar: true, // 진행바
    });

    bootstrap.Modal.getInstance(document.getElementById('editPlaceModal')).hide(); // 수정 모달 닫기
    loadPlaces(); // 목록 다시 로드
  } catch (error) {
    Swal.fire({
      icon: 'error', // 에러 아이콘
      title: '수정 실패', // 에러 제목
      text: error.message, // 에러 메시지
      confirmButtonColor: '#2563eb', // 버튼 색상
    });
  }
}

// 등록 폼 유효성 검사
function validateAddForm(data) {
  if (!data.name) {
    showValidationError('가게 이름을 입력해주세요.'); // 이름 검증
    return false;
  }

  if (!data.address) {
    showValidationError('주소를 입력해주세요.'); // 주소 검증
    return false;
  }

  if (!data.category) {
    showValidationError('카테고리를 선택해주세요.'); // 카테고리 검증
    return false;
  }

  if (!data.call) {
    showValidationError('전화번호를 입력해주세요.'); // 전화번호 검증
    return false;
  }

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    showValidationError('별점을 선택해주세요. (1~5점)'); // 별점 검증
    return false;
  }

  if (!data.lat || !data.lng) {
    showValidationError('지도에서 위치를 선택해주세요.'); // 좌표 검증
    return false;
  }

  return true; // 등록 검증 통과
}

// 수정 폼 유효성 검사
function validateEditForm(data) {
  if (!data.name) {
    showValidationError('가게 이름을 입력해주세요.'); // 이름 검증
    return false;
  }

  if (!data.address) {
    showValidationError('주소를 입력해주세요.'); // 주소 검증
    return false;
  }

  if (!data.category) {
    showValidationError('카테고리를 선택해주세요.'); // 카테고리 검증
    return false;
  }

  if (!data.call) {
    showValidationError('전화번호를 입력해주세요.'); // 전화번호 검증
    return false;
  }

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    showValidationError('별점을 선택해주세요. (1~5점)'); // 별점 검증
    return false;
  }

  return true; // 수정 검증 통과
}

