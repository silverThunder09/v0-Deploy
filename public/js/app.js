// 전역 변수
let places = [];
let filteredPlaces = [];
let currentEditId = null;
let currentFilter = 'all';

// DOM 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', function () {
  loadPlaces();
  setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
  // 등록 폼 제출
  document.getElementById('addPlaceForm').addEventListener('submit', handleAddPlace);

  // 수정 폼 제출
  document.getElementById('editPlaceForm').addEventListener('submit', handleEditPlace);

  // 필터 탭
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      filterPlaces();
    });
  });

  // 모달 닫힐 때 폼 초기화
  document.getElementById('addPlaceModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('addPlaceForm').reset();
    resetStarRating('add');
  });

  document.getElementById('editPlaceModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('editPlaceForm').reset();
    resetStarRating('edit');
    currentEditId = null;
  });
}

// 별점 초기화
function resetStarRating(formType) {
  const stars = document.querySelectorAll(`#${formType}PlaceForm .star-rating-input input`);
  stars.forEach((star) => (star.checked = false));
}

// 맛집 목록 로드
async function loadPlaces() {
  showLoading();
  try {
    places = await getAllPlaces();
    filterPlaces();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '오류 발생',
      text: '맛집 목록을 불러오는데 실패했습니다.',
      confirmButtonColor: '#2563eb',
    });
  }
}

// 필터링
function filterPlaces() {
  if (currentFilter === 'all') {
    filteredPlaces = [...places];
  } else {
    filteredPlaces = places.filter(p => p.category === currentFilter);
  }
  renderPlaces();
  updateCount();
}

// 개수 업데이트
function updateCount() {
  document.getElementById('displayCount').textContent = filteredPlaces.length;
}

// 로딩 표시
function showLoading() {
  const container = document.getElementById('placesContainer');
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">맛집 목록을 불러오는 중...</span>
    </div>
  `;
}

// 맛집 목록 렌더링
function renderPlaces() {
  const container = document.getElementById('placesContainer');

  if (filteredPlaces.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-utensils"></i>
        </div>
        <h3 class="empty-title">등록된 맛집이 없습니다</h3>
        <p class="empty-desc">새로운 맛집을 등록해보세요!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredPlaces
    .map(
      (place, index) => `
    <div class="card-animate" style="animation-delay: ${index * 0.05}s">
      <div class="place-card">
        <div class="card-top">
          <div class="card-header-row">
            <h3 class="card-title">${escapeHtml(place.name)}</h3>
            <span class="category-tag ${getCategoryClass(place.category)}">
              ${escapeHtml(place.category)}
            </span>
          </div>
          <div class="rating-display">
            <div class="rating-stars">
              ${renderStars(place.rating)}
            </div>
            <span class="rating-number">${place.rating}.0</span>
          </div>
        </div>
        
        <div class="card-body">
          <div class="info-item">
            <div class="info-icon">
              <i class="fas fa-map-marker-alt"></i>
            </div>
            <div class="info-text">
              <div class="info-label">주소</div>
              <div class="info-value">${escapeHtml(place.address)}</div>
            </div>
          </div>
          
          <div class="info-item">
            <div class="info-icon">
              <i class="fas fa-phone"></i>
            </div>
            <div class="info-text">
              <div class="info-label">전화번호</div>
              <div class="info-value">${escapeHtml(place.call)}</div>
            </div>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn-card btn-edit" onclick="openEditModal(${place.id})">
            <i class="fas fa-pen"></i>
            수정
          </button>
          <button class="btn-card btn-delete" onclick="confirmDelete(${place.id}, '${escapeHtml(place.name)}')">
            <i class="fas fa-trash"></i>
            삭제
          </button>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

// 별점 렌더링
function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += '<i class="fas fa-star"></i>';
    } else {
      stars += '<i class="fas fa-star empty"></i>';
    }
  }
  return stars;
}

// 카테고리 클래스 반환
function getCategoryClass(category) {
  const categoryMap = {
    한식: 'category-korean',
    중식: 'category-chinese',
    일식: 'category-japanese',
    양식: 'category-western',
    카페: 'category-cafe',
  };
  return categoryMap[category] || 'category-etc';
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 맛집 등록 처리
async function handleAddPlace(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('addName').value.trim(),
    address: document.getElementById('addAddress').value.trim(),
    category: document.getElementById('addCategory').value,
    call: document.getElementById('addCall').value.trim(),
    rating: parseInt(document.querySelector('input[name="addRating"]:checked')?.value || 0),
  };

  if (!validateForm(formData)) return;

  try {
    Swal.fire({
      title: '등록 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    await createPlace(formData);

    Swal.fire({
      icon: 'success',
      title: '등록 완료',
      text: `'${formData.name}'이(가) 등록되었습니다.`,
      confirmButtonColor: '#2563eb',
      timer: 2000,
      timerProgressBar: true,
    });

    bootstrap.Modal.getInstance(document.getElementById('addPlaceModal')).hide();
    loadPlaces();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '등록 실패',
      text: error.message,
      confirmButtonColor: '#2563eb',
    });
  }
}

// 수정 모달 열기
function openEditModal(id) {
  const place = places.find((p) => p.id == id);
  if (!place) return;

  currentEditId = id;

  document.getElementById('editName').value = place.name;
  document.getElementById('editAddress').value = place.address;
  document.getElementById('editCategory').value = place.category;
  document.getElementById('editCall').value = place.call;

  const ratingInput = document.querySelector(`input[name="editRating"][value="${place.rating}"]`);
  if (ratingInput) ratingInput.checked = true;

  new bootstrap.Modal(document.getElementById('editPlaceModal')).show();
}

// 맛집 수정 처리
async function handleEditPlace(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('editName').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    category: document.getElementById('editCategory').value,
    call: document.getElementById('editCall').value.trim(),
    rating: parseInt(document.querySelector('input[name="editRating"]:checked')?.value || 0),
  };

  if (!validateForm(formData)) return;

  try {
    Swal.fire({
      title: '수정 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    await updatePlace(currentEditId, formData);

    Swal.fire({
      icon: 'success',
      title: '수정 완료',
      text: `'${formData.name}'이(가) 수정되었습니다.`,
      confirmButtonColor: '#2563eb',
      timer: 2000,
      timerProgressBar: true,
    });

    bootstrap.Modal.getInstance(document.getElementById('editPlaceModal')).hide();
    loadPlaces();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '수정 실패',
      text: error.message,
      confirmButtonColor: '#2563eb',
    });
  }
}

// 삭제 확인
function confirmDelete(id, name) {
  Swal.fire({
    title: '맛집 삭제',
    html: `<strong>'${name}'</strong>을(를) 삭제하시겠습니까?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '삭제',
    cancelButtonText: '취소',
    reverseButtons: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: '삭제 중...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        await deletePlace(id);

        Swal.fire({
          icon: 'success',
          title: '삭제 완료',
          text: `'${name}'이(가) 삭제되었습니다.`,
          confirmButtonColor: '#2563eb',
          timer: 2000,
          timerProgressBar: true,
        });

        loadPlaces();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: '삭제 실패',
          text: error.message,
          confirmButtonColor: '#2563eb',
        });
      }
    }
  });
}

// 폼 유효성 검사
function validateForm(data) {
  if (!data.name) {
    showValidationError('가게 이름을 입력해주세요.');
    return false;
  }
  if (!data.address) {
    showValidationError('주소를 입력해주세요.');
    return false;
  }
  if (!data.category) {
    showValidationError('카테고리를 선택해주세요.');
    return false;
  }
  if (!data.call) {
    showValidationError('전화번호를 입력해주세요.');
    return false;
  }
  if (!data.rating || data.rating < 1 || data.rating > 5) {
    showValidationError('별점을 선택해주세요. (1~5점)');
    return false;
  }
  return true;
}

// 유효성 검사 에러 표시
function showValidationError(message) {
  Swal.fire({
    icon: 'warning',
    title: '입력 확인',
    text: message,
    confirmButtonColor: '#2563eb',
  });
}
