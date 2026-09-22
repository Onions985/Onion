<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 44 })
</script>
<template>
  <img
    src="/brand/onion-mark.svg"
    :width="size"
    :height="size"
    alt=""
    class="onion-logo"
    aria-hidden="true"
  />
</template>
