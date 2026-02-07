document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('gg-modal');
  const closeBtn = document.querySelector('.gg-modal__close');
  const overlay = document.querySelector('.gg-modal__overlay');
  const modalImg = document.getElementById('modal-img');
  const modalTitle = document.getElementById('modal-title');
  const modalPrice = document.getElementById('modal-price');
  const modalDesc = document.getElementById('modal-description');
  const modalVariants = document.getElementById('modal-variants');
  const hiddenInputId = document.getElementById('modal-variant-id');
  const atcBtn = document.getElementById('gg-atc-btn');
  const errorMsg = document.getElementById('gg-error-msg');
  const form = document.getElementById('gg-atc-form');

  let currentProduct = null;

  // 1. Open Modal Logic
  document.querySelectorAll('.gg-card').forEach(card => {
    card.addEventListener('click', () => {
      const jsonScript = card.querySelector('.gg-product-json');
      if (!jsonScript) return;

      currentProduct = JSON.parse(jsonScript.innerHTML);
      openModal(currentProduct);
    });
  });

  // 2. Populate and Show Modal
  function openModal(product) {
    modalTitle.textContent = product.title;
    modalDesc.innerHTML = product.description; // description often contains HTML
    modalImg.src = product.featured_image;
    modalImg.alt = product.title;
    
    // Clear previous variants
    modalVariants.innerHTML = '';
    
    // Check if product has variants other than 'Default Title'
    const hasVariants = product.variants.length > 1 || product.options[0].name !== 'Title';

    if (hasVariants) {
      product.options.forEach((option, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gg-variant-group';
        
        const label = document.createElement('label');
        label.textContent = option.name;
        
        const select = document.createElement('select');
        select.dataset.index = index; // track option position (0, 1, 2)
        select.addEventListener('change', updateVariantState);

        option.values.forEach(value => {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = value;
          select.appendChild(opt);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        modalVariants.appendChild(wrapper);
      });
    }

    // Trigger initial update to set price and ID
    updateVariantState();
    
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden'; // prevent background scrolling
  }

  // 3. Variant Matching Logic
  function updateVariantState() {
    // Get all selected values
    const selects = modalVariants.querySelectorAll('select');
    const selectedOptions = Array.from(selects).map(sel => sel.value);

    let matchedVariant = currentProduct.variants.find(variant => {
      // Compare options arrays. Note: Shopify variant options are option1, option2, option3
      return selectedOptions.every((val, index) => {
        return variant[`option${index + 1}`] === val;
      });
    });

    // If no variants (simple product), use first variant
    if (!matchedVariant && currentProduct.variants.length === 1) {
      matchedVariant = currentProduct.variants[0];
    }

    if (matchedVariant) {
      // Update UI
      modalPrice.textContent = formatMoney(matchedVariant.price);
      if (matchedVariant.featured_image) {
        modalImg.src = matchedVariant.featured_image.src;
      }
      
      // Update Inputs
      hiddenInputId.value = matchedVariant.id;
      
      // Update Button
      if (!matchedVariant.available) {
        atcBtn.textContent = 'Sold Out';
        atcBtn.disabled = true;
      } else {
        atcBtn.textContent = 'Add to Cart';
        atcBtn.disabled = false;
      }
    } else {
      // Combination doesn't exist
      atcBtn.textContent = 'Unavailable';
      atcBtn.disabled = true;
    }
  }

  // 4. Add to Cart & Special Rule
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';
    atcBtn.textContent = 'Adding...';

    const mainVariantId = hiddenInputId.value;
    const itemsToAdd = [{ id: mainVariantId, quantity: 1 }];

    // --- Special Rule Logic ---
    // Check if "Black" and "Medium" are selected
    const selects = modalVariants.querySelectorAll('select');
    let isBlack = false;
    let isMedium = false;

    selects.forEach(sel => {
      const val = sel.value.toLowerCase();
      if (val === 'black') isBlack = true;
      if (val === 'medium') isMedium = true;
    });

    // If rule matches and we have a bonus product ID set in Liquid
    if (isBlack && isMedium && window.giftGuideSettings.bonusProductVariantId) {
       // Only add if ID is valid (not 0)
       if(window.giftGuideSettings.bonusProductVariantId != 0){
          itemsToAdd.push({
            id: window.giftGuideSettings.bonusProductVariantId,
            quantity: 1
          });
       }
    }

    // Ajax Add to Cart
    fetch(window.Shopify.routes.root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToAdd })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status) {
        throw new Error(data.description); // Handle Shopify errors
      }
      // Success
      atcBtn.textContent = 'Added!';
      setTimeout(() => {
        closeModal();
        // Optional: Open cart drawer or refresh page
        // window.location.reload(); 
        // For standard themes, updating bubble is common:
        document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true })); 
      }, 1000);
    })
    .catch(error => {
      console.error('Error:', error);
      atcBtn.textContent = 'Add to Cart';
      errorMsg.textContent = error.message;
      errorMsg.style.display = 'block';
    });
  });

  // Utilities
  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD' // You can make this dynamic if needed
    });
  }

  // Event Listeners for closing
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
});