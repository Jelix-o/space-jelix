<template>
  <AppSelect
    :model-value="modelValue"
    :options="modelOptions"
    :placeholder="placeholder"
    :placement="placement"
    @update:model-value="selectModel"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from '@/components/AppSelect.vue'
import type { ModelInfo } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: string
  models: ModelInfo[]
  placeholder?: string
  placement?: 'down' | 'up'
}>(), {
  placeholder: '选择模型',
  placement: 'down',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const modelOptions = computed(() =>
  props.models.map((model) => ({
    value: model.id,
    label: `${model.name} (${model.provider})`,
    subtitle: model.provider,
  })),
)

function selectModel(modelId: string) {
  emit('update:modelValue', modelId)
  emit('change', modelId)
}
</script>
