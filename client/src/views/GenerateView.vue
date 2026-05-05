<template>
  <section class="page generate-page">
    <header class="page-hero compact-hero">
      <div class="hero-icon"><Image :size="42" /></div>
      <div>
        <h1 class="page-title">AI 生图</h1>
        <p class="page-subtitle">输入描述，生成图片</p>
      </div>
    </header>

    <section class="gen-panel glass-card">
      <div class="field">
        <label>提示词</label>
        <textarea v-model="prompt" rows="3" placeholder="描述你想要生成的图片内容..." />
      </div>

      <div class="gen-options">
        <div class="field">
          <label>模型</label>
          <AppSelect v-model="selectedModel" :options="imageModelOptions" />
        </div>
        <div class="field">
          <label>尺寸</label>
          <AppSelect v-model="selectedSize" :options="sizeOptions" />
        </div>
      </div>

      <button class="primary-btn gen-btn" :disabled="generating || !prompt.trim()" @click="doGenerate">
        <Sparkles :size="20" />
        {{ generating ? '生成中...' : '生成图片' }}
      </button>

      <p v-if="genError" class="error-text">{{ genError }}</p>
    </section>

    <section v-if="images.length" class="gallery-section">
      <h2 class="section-title">历史记录</h2>
      <div class="gallery-grid">
        <div v-for="img in images" :key="img.id" class="gallery-item glass-card" @click="preview = img.url">
          <img :src="img.url" :alt="img.prompt" loading="lazy" />
          <div class="gallery-meta">
            <small>{{ img.model }}</small>
            <small>{{ img.size }}</small>
          </div>
        </div>
      </div>
    </section>

    <div v-else-if="!generating && loaded" class="empty-state glass-card">还没有生成过图片</div>

    <!-- Preview overlay -->
    <Teleport to="body">
      <div v-if="preview" class="preview-backdrop" @click.self="preview = null">
        <img :src="preview" class="preview-img" />
        <button class="ghost-btn preview-close" @click="preview = null"><X :size="28" /></button>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Image, Sparkles, X } from 'lucide-vue-next'
import AppSelect from '@/components/AppSelect.vue'
import { imagesApi, providersApi } from '@/api'
import { useToast } from '@/composables/useToast'
import { useNativeBackClose } from '@/composables/useNativeBackClose'
import type { GeneratedImage, ProviderInfo } from '@/types'

const toast = useToast()

const prompt = ref('')
const selectedModel = ref('')
const selectedSize = ref('1024x1024')
const generating = ref(false)
const genError = ref('')
const images = ref<GeneratedImage[]>([])
const loaded = ref(false)
const preview = ref<string | null>(null)
const providers = ref<ProviderInfo[]>([])

useNativeBackClose(() => Boolean(preview.value), () => {
  preview.value = null
})

const sizeOptions = [
  { value: '1024x1024', label: '1:1 正方形', subtitle: '1024x1024' },
  { value: '1024x1536', label: '9:16 竖版', subtitle: '1024x1536' },
  { value: '1536x1024', label: '16:9 横版', subtitle: '1536x1024' },
]

const imageModelOptions = computed(() => {
  const opts: { value: string; label: string; subtitle: string }[] = []
  for (const p of providers.value) {
    for (const m of p.models) {
      if (m.is_image_model) {
        opts.push({ value: m.model_id, label: m.name || m.model_id, subtitle: p.name })
      }
    }
  }
  return opts
})

onMounted(async () => {
  try {
    providers.value = await providersApi.list()
    if (imageModelOptions.value.length && !selectedModel.value) {
      selectedModel.value = imageModelOptions.value[0].value
    }
  } catch {}
  try {
    const result = await imagesApi.list()
    images.value = result.images
  } catch {}
  loaded.value = true
})

async function doGenerate() {
  generating.value = true
  genError.value = ''
  try {
    const result = await imagesApi.generate(selectedModel.value, prompt.value.trim(), selectedSize.value)
    images.value.unshift({
      id: result.id,
      model: result.model,
      prompt: result.prompt,
      size: result.size,
      url: result.url,
      created_at: new Date().toISOString(),
    })
    toast.success('图片已生成')
  } catch (e) {
    genError.value = e instanceof Error ? e.message : '生成失败'
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.generate-page {
  max-width: 920px;
}

.gen-panel {
  display: grid;
  gap: 16px;
  padding: 24px;
  margin-bottom: 28px;
}

.gen-panel textarea {
  width: 100%;
  min-height: 80px;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  color: var(--text-strong);
  background: var(--panel-strong);
  font-size: 0.95rem;
  resize: vertical;
  outline: none;
}

.gen-panel textarea:focus {
  border-color: var(--accent);
}

.gen-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.gen-btn {
  min-height: 52px;
  font-size: 1rem;
}

.error-text {
  color: var(--danger);
  font-weight: 800;
}

.section-title {
  color: var(--text-strong);
  font-size: 1.2rem;
  font-weight: 900;
  margin-bottom: 16px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.gallery-item {
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  transition: transform 0.15s;
}

.gallery-item:hover {
  transform: translateY(-2px);
}

.gallery-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.gallery-meta {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  color: var(--text);
  font-size: 0.78rem;
}

.preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
}

.preview-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.preview-close {
  position: fixed;
  top: 16px;
  right: 16px;
  color: #fff;
}

@media (max-width: 560px) {
  .gen-options {
    grid-template-columns: 1fr;
  }

  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
