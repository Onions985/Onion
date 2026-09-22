<script setup lang="ts">
definePageMeta({
  validate: (route) =>
    ['zh', 'en'].includes(String(route.params.locale)) &&
    typeof route.params.tag === 'string' &&
    !!route.params.tag.trim() &&
    route.params.tag.length <= 40,
})
</script>
<template><ContentList kind="blog" /></template>
